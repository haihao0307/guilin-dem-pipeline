"""Lossless preview transfer. Reject damaged rows, recover erasures, verify full SHA256."""
import base64, hashlib, json, zlib
from pathlib import Path
K, R, L = 32, 8, 192
EXP, LOG = [0] * 512, [0] * 256
x = 1
for i in range(255):
    EXP[i], LOG[x] = x, i
    x <<= 1
    if x & 256:
        x ^= 0x11d
for i in range(255, 512):
    EXP[i] = EXP[i - 255]
def mul(a, b):
    return 0 if not a or not b else EXP[LOG[a] + LOG[b]]
def inv(a):
    if not a:
        raise ValueError('zero divisor')
    return EXP[255 - LOG[a]]
P = [[inv(i ^ (j + 32)) for j in range(K)] for i in range(R)]
TABLE = [bytes(mul(a, b) for b in range(256)) for a in range(256)]
def decode_block(text):
    rows, bad = {}, []
    for line in text.splitlines():
        try:
            ix, crc, encoded = line.strip().split(':', 2)
            i = int(ix)
            v = base64.b64decode(encoded, validate=True)
            if not 0 <= i < K + R or len(v) != L or zlib.crc32(v) != int(crc, 16):
                bad.append(ix)
                continue
            rows[i] = v
        except Exception:
            bad.append('malformed')
    missing = [i for i in range(K) if i not in rows]
    m = len(missing)
    if m:
        parity = [i for i in range(K, K + R) if i in rows][:m]
        if len(parity) != m:
            raise ValueError(f'Too many damaged rows: {missing}; {bad}')
        A = [[P[i - K][j] for j in missing] for i in parity]
        B = []
        for i in parity:
            b = bytearray(rows[i])
            for j in range(K):
                if j in missing:
                    continue
                for k, v in enumerate(rows[j].translate(TABLE[P[i - K][j]])):
                    b[k] ^= v
            B.append(b)
        for col in range(m):
            pivot = next(i for i in range(col, m) if A[i][col])
            A[col], A[pivot] = A[pivot], A[col]
            B[col], B[pivot] = B[pivot], B[col]
            c = inv(A[col][col])
            A[col] = [mul(c, v) for v in A[col]]
            B[col] = bytearray(bytes(B[col]).translate(TABLE[c]))
            for i in range(m):
                if i == col:
                    continue
                c = A[i][col]
                if c:
                    A[i] = [a ^ mul(c, b) for a, b in zip(A[i], A[col])]
                    B[i] = bytearray(a ^ b for a, b in zip(B[i], bytes(B[col]).translate(TABLE[c])))
        for j, v in zip(missing, B):
            rows[j] = bytes(v)
    return b''.join(rows[i] for i in range(K)), {'repairedRows': missing, 'rejectedRows': bad}
def decode_directory(root, output):
    root = Path(root)
    meta = json.loads((root / 'transfer.json').read_text())
    blocks, reports = [], []
    for name in meta['blocks']:
        b, report = decode_block((root / name).read_text())
        blocks.append(b)
        reports.append({'block': name, **report})
    b = b''.join(blocks)[:meta['bytes']]
    if hashlib.sha256(b).hexdigest() != meta['sha256']:
        raise ValueError('Full archive SHA256 mismatch')
    Path(output).write_bytes(b)
    return reports
if __name__ == '__main__':
    import sys
    print(json.dumps(decode_directory(sys.argv[1], sys.argv[2]), indent=2))
