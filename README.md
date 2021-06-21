# littlefs disk image viewer

This tool allows browsing [littlefs](https://github.com/littlefs-project/littlefs)
disk images from within your web browser.

[Click here](https://tniessen.github.io/littlefs-disk-img-viewer/) to use the
most recent version of this application.

## How it works

This application implements an emulated block device for littlefs, which has
been compiled to [WebAssembly](https://webassembly.org/). By only loading the
parts of the disk image that are currently used by littlefs, almost arbitrarily
large disk images can be loaded without requiring much memory. By default, the
application caches up to 1 MiB of data in memory and allocates 64 KiB of memory
for the littlefs implementation.

## Troubleshooting

This web application requires a modern web browser to work. If you are using an
older web browser, please update your browser before filing a bug report.

This tool does not support the old file system structure that was used by older
versions of littlefs. Try using `lfs_migrate` to convert your disk image to the
new file system layout before attempting to mount it.

While most options can be determined automatically, the block size cannot. If
mounting fails or directory contents are not displayed correctly, please ensure
that you entered the correct block size for the disk image you are trying to
mount.
