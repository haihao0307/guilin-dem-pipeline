#pragma once

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct ZSTD_CCtx_s ZSTD_CCtx;

typedef enum {
  ZSTD_c_compressionLevel = 100
} ZSTD_cParameter;

size_t ZSTD_compressBound(size_t srcSize);
ZSTD_CCtx* ZSTD_createCCtx(void);
size_t ZSTD_freeCCtx(ZSTD_CCtx* cctx);
size_t ZSTD_CCtx_setParameter(ZSTD_CCtx* cctx, ZSTD_cParameter param, int value);
size_t ZSTD_compress2(ZSTD_CCtx* cctx, void* dst, size_t dstCapacity,
                      const void* src, size_t srcSize);
size_t ZSTD_decompress(void* dst, size_t dstCapacity, const void* src, size_t compressedSize);
unsigned ZSTD_isError(size_t code);

#ifdef __cplusplus
}
#endif
