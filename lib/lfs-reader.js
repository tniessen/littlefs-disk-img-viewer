'use strict';

(typeof module !== 'undefined' && module.exports || window).createLfsImageReader = async (opts) => {
  const { read } = opts;

  const { MAX_PATH_SIZE, FILE_READ_BUFFER_SIZE } = appResources.definitions;

  let rewindCallback = undefined;
  function onAsyncRewind(fn) {
    if (rewindCallback !== undefined) {
      throw new Error('Another callback is already registered');
    }
    rewindCallback = fn;
  }

  let traverseCallback;

  const bytes = await (typeof fetch === 'function' ? fetch('main.async.wasm').then((res) => res.arrayBuffer()) : require('fs').promises.readFile(__dirname + '/../main.async.wasm'));
  const { instance: wasm } = await WebAssembly.instantiate(bytes, {
    env: {
      readFileRange(offset, ptr, size) {
        if (wasm.exports.asyncify_get_state() !== 0) {
          wasm.exports.asyncify_stop_rewind();
          return;
        }

        const ret = read(offset, wasm.exports.memory.buffer, ptr, size);
        if (ret === undefined) {
          rewindCallback = undefined;
        } else {
          wasm.exports.prepare_asyncify_unwind();
          const dataAddr = wasm.exports.get_asyncify_info();
          wasm.exports.asyncify_start_unwind(dataAddr);

          ret.then(() => {
            wasm.exports.asyncify_start_rewind(dataAddr);
            const fn = rewindCallback;
            rewindCallback = undefined;
            fn();
          });
        }
      },
      traverseCallback(_, block) {
        traverseCallback(block);
      }
    }
  });

  function x(ret, message) {
    if (ret < 0) {
      throw new Error(`${message}: ${ret}`);
    }
    return ret;
  }

  // Pointers to statically allocated memory.
  const img = wasm.exports.get_lfs_image();
  const dir = wasm.exports.get_lfs_dir();
  const file = wasm.exports.get_lfs_file();
  const fileConfig = wasm.exports.get_lfs_file_config();
  const info = wasm.exports.get_lfs_info();
  const pathBuf = wasm.exports.get_lfs_path_buffer();
  const fileReadBuffer = wasm.exports.get_file_read_buffer();
  const attrSizes = wasm.exports.get_attr_sizes();

  function callAsync(fn) {
    let ret = fn();
    if (wasm.exports.asyncify_get_state() === 0) {
      return Promise.resolve(ret);
    }

    if (ret !== 0) {
      throw new Error(`Async operation should have returned 0, but got ${ret}`);
    }

    return new Promise((resolve, reject) => {
      onAsyncRewind(() => callAsync(fn).then(resolve, reject));
    });
  }

  async function openImage(readSize, cacheSize, lookaheadSize, blockSize, blockCount) {
    const config = x(wasm.exports.configure(readSize, cacheSize, lookaheadSize, blockSize, blockCount), 'configure');
    x(await callAsync(() => wasm.exports.lfs_mount(img, config)), 'lfs_mount');
  }

  function writePathBuffer(path) {
    // TODO: Check overflow
    const enc = new TextEncoder();
    const out = new Uint8Array(wasm.exports.memory.buffer, pathBuf, MAX_PATH_SIZE);
    out[enc.encodeInto(path, out).written] = 0;
  }

  async function openDir(path) {
    writePathBuffer(path);
    x(await callAsync(() => wasm.exports.lfs_dir_open(img, dir, pathBuf)), 'lfs_dir_open');
  }

  async function readDir() {
    let ret = x(await callAsync(() => wasm.exports.lfs_dir_read(img, dir, info), 'lfs_dir_read'));
    if (ret === 0) return null;
    const dec = new TextDecoder();
    return {
      type: wasm.exports.get_lfs_info_type(),
      size: wasm.exports.get_lfs_info_size(),
      name: dec.decode(new Uint8Array(wasm.exports.memory.buffer, wasm.exports.get_lfs_info_name(), wasm.exports.get_lfs_info_name_length()))
    };
  }

  function closeDir() {
    x(wasm.exports.lfs_dir_close(img, dir), 'lfs_dir_close');
  }

  async function openFile(path) {
    writePathBuffer(path);
    x(await callAsync(() => wasm.exports.lfs_file_opencfg(img, file, pathBuf, 1, fileConfig)), 'lfs_file_open');
  }

  async function readFile() {
    const n = x(await callAsync(() => wasm.exports.lfs_file_read(img, file, fileReadBuffer, FILE_READ_BUFFER_SIZE)), 'lfs_file_read');
    return new Uint8Array(wasm.exports.memory.buffer, fileReadBuffer, n);
  }

  function closeFile() {
    x(wasm.exports.lfs_file_close(img, file), 'lfs_file_close');
  }

  async function traverse(callback) {
    traverseCallback = callback;
    x(await callAsync(() => wasm.exports.do_lfs_traverse()));
  }

  async function countAttributes(path) {
    writePathBuffer(path);
    return x(await callAsync(() => wasm.exports.list_lfs_attr()), 'list_lfs_attr');
  }

  async function listAttributes(path) {
    const n = await countAttributes(path);
    const array = new Uint16Array(wasm.exports.memory.buffer, attrSizes, 256);
    const attrs = [];
    for (let i = 0; i < 256; i++) {
      if (array[i] !== 0xffff) {
        attrs.push([i, array[i]]);
      }
    }
    if (attrs.length !== n) {
      throw new Error('Reported number of attributes does not match.');
    }
    return attrs;
  }

  async function readAttribute(path, tag) {
    writePathBuffer(path);
    const size = x(await callAsync(() => wasm.exports.lfs_getattr(img, pathBuf, tag, fileReadBuffer, FILE_READ_BUFFER_SIZE)), 'lfs_getattr');
    return new Uint8Array(wasm.exports.memory.buffer, fileReadBuffer, size);
  }

  console.log('data end', wasm.exports.__data_end.valueOf());
  console.log('global', wasm.exports.__global_base.valueOf());
  console.log('heap', wasm.exports.__heap_base.valueOf());
  console.log('memory', wasm.exports.__memory_base.valueOf());
  console.log('table', wasm.exports.__table_base.valueOf());

  if (wasm.exports.memory.buffer.byteLength !== 64 * 1024) {
    throw new Error(`WebAssembly should allocate exactly one page, but allocated ${wasm.exports.memory.buffer.byteLength}`);
  }

  return {
    openImage,
    openDir,
    readDir,
    closeDir,
    openFile,
    readFile,
    closeFile,
    traverse,
    countAttributes,
    listAttributes,
    readAttribute
  };
};
