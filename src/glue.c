#include "littlefs/lfs.h"

#include <stdint.h>
#include <string.h>

static int32_t asyncify_info[2];
static uint8_t asyncify_buffer[ASYNCIFY_BUFFER_SIZE];

int32_t* get_asyncify_info(void) {
  return asyncify_info;
}

void prepare_asyncify_unwind(void) {
  asyncify_info[0] = (intptr_t) asyncify_buffer;
  asyncify_info[1] = asyncify_info[0] + sizeof(asyncify_buffer);
}

void read_file_range(uint32_t offset, void* buf, uint32_t length) __attribute__((import_module("env"), import_name("readFileRange")));

static enum lfs_error bd_read(const struct lfs_config* c, lfs_block_t block, lfs_off_t off, void* buffer, lfs_size_t size) {
  read_file_range(block * c->block_size + off, buffer, size);
  return 0;
}

static uint8_t lfs_read_buffer[MAX_CACHE_SIZE];
static uint8_t lfs_prog_buffer[MAX_CACHE_SIZE];
static uint8_t lfs_lookahead_buffer[MAX_LOOKAHEAD_SIZE] __attribute__((aligned(4)));

static struct lfs_config config = {
  .read = bd_read,
  .read_buffer = lfs_read_buffer,
  .lookahead_buffer = lfs_lookahead_buffer,
  .prog_buffer = lfs_prog_buffer
};

struct lfs_config* configure(uint32_t read_size, uint32_t cache_size, uint32_t lookahead_size, uint32_t block_size, uint32_t block_count) {
  config.read_size = read_size;
  config.prog_size = read_size;
  config.cache_size = cache_size;
  config.lookahead_size = lookahead_size;
  config.block_size = block_size;
  config.block_count = block_count;
  return &config;
}

static lfs_t image;
lfs_t* get_lfs_image(void) {
  return &image;
}

static char lfs_path_buffer[MAX_PATH_SIZE];
char* get_lfs_path_buffer(void) {
  return lfs_path_buffer;
}
size_t get_lfs_path_buffer_size(void) {
  return sizeof(lfs_path_buffer);
}

static lfs_dir_t lfs_dir;
lfs_dir_t* get_lfs_dir(void) {
  return &lfs_dir;
}

static struct lfs_info lfs_info;
struct lfs_info* get_lfs_info(void) {
  return &lfs_info;
}

uint8_t get_lfs_info_type(void) {
  return lfs_info.type;
}

lfs_size_t get_lfs_info_size(void) {
  return lfs_info.size;
}

char* get_lfs_info_name(void) {
  return lfs_info.name;
}

size_t get_lfs_info_name_length(void) {
  return strlen(lfs_info.name);
}

static uint8_t internal_file_buffer[MAX_CACHE_SIZE];
static struct lfs_file_config lfs_file_config = {
  .buffer = internal_file_buffer
};
struct lfs_file_config* get_lfs_file_config(void) {
  return &lfs_file_config;
}

static lfs_file_t lfs_file;
lfs_file_t* get_lfs_file(void) {
  return &lfs_file;
}

uint8_t file_read_buffer[FILE_READ_BUFFER_SIZE];
uint8_t* get_file_read_buffer(void) {
  return file_read_buffer;
}

int traverse_callback(void*, lfs_block_t) __attribute__((import_module("env"), import_name("traverseCallback")));

int do_lfs_traverse(void) {
  return lfs_fs_traverse(&image, traverse_callback, NULL);
}

uint16_t attr_sizes[256] __attribute__((aligned(2)));
uint16_t* get_attr_sizes(void) {
  return attr_sizes;
}

int list_lfs_attr(void) {
  unsigned int count = 0;
  for (unsigned int i = 0; i <= 0xff; i++) {
    lfs_ssize_t sz = lfs_getattr(&image, lfs_path_buffer, (uint8_t) i, NULL, 0);
    if (sz >= 0) {
      count++;
      attr_sizes[i] = (uint16_t) sz;
    } else if (sz == LFS_ERR_NOATTR) {
      attr_sizes[i] = (uint16_t) -1;
    } else {
      return (int) sz;
    }
  }
  return count;
}
