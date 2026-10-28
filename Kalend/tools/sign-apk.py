#!/usr/bin/env python3
"""
sign-apk.py — firma un APK con lo schema di firma Android v2 (APK Signature
Scheme v2), senza l'SDK Android. Serve per le PROVE: usa una chiave
auto-generata (android/test-key.pem, creata al primo uso e NON da pubblicare).
Per il Play Store e per aggiornare l'app già installata si deve usare
apksigner con il proprio keystore: un'app firmata con una chiave diversa
non può aggiornare quella esistente (va prima disinstallata).

Uso:  python3 Kalend/tools/sign-apk.py [input.apk] [--out output.apk] [--key chiave.pem]

Come funziona (v2): l'APK viene diviso in tre parti (voci zip, directory
centrale, record finale EOCD); di ognuna si calcola un'impronta SHA-256 a
blocchi da 1 MB; le impronte, firmate con RSA, finiscono in un «APK Signing
Block» inserito prima della directory centrale; l'offset della directory
nell'EOCD viene aggiornato. Android ≥ 7 verifica proprio questo blocco.
"""
import os, struct, sys, hashlib, datetime
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography import x509
from cryptography.x509.oid import NameOID

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = sys.argv[1:]
inp = next((a for a in args if a.endswith('.apk') and not args[max(0, args.index(a) - 1)] == '--out'), os.path.join(ROOT, 'dist', 'Kalend-unsigned.apk'))
out = args[args.index('--out') + 1] if '--out' in args else os.path.join(ROOT, 'dist', 'Kalend-test-signed.apk')
keyfile = args[args.index('--key') + 1] if '--key' in args else os.path.join(ROOT, 'android', 'test-key.pem')

# ── chiave e certificato di prova ──
if os.path.exists(keyfile):
    key = serialization.load_pem_private_key(open(keyfile, 'rb').read(), password=None)
    cert = x509.load_pem_x509_certificate(open(keyfile.replace('.pem', '.crt'), 'rb').read())
else:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'Kalend test key (not for release)')])
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
            .serial_number(x509.random_serial_number()).not_valid_before(now - datetime.timedelta(days=1))
            .not_valid_after(now + datetime.timedelta(days=365 * 30)).sign(key, hashes.SHA256()))
    os.makedirs(os.path.dirname(keyfile), exist_ok=True)
    open(keyfile, 'wb').write(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    open(keyfile.replace('.pem', '.crt'), 'wb').write(cert.public_bytes(serialization.Encoding.PEM))
    print('chiave di prova creata in', os.path.relpath(keyfile))

apk = open(inp, 'rb').read()

# ── le tre sezioni dello zip ──
eocd_pos = apk.rfind(b'PK\x05\x06')
if eocd_pos < 0:
    sys.exit('EOCD non trovato: non è uno zip valido')
eocd = apk[eocd_pos:]
cd_size, cd_off = struct.unpack('<II', eocd[12:20])
entries = apk[:cd_off]
cd = apk[cd_off:cd_off + cd_size]
assert cd_off + cd_size == eocd_pos, 'struttura zip inattesa (forse già firmato v2)'

SIG_ALG = 0x0103          # RSASSA-PKCS1-v1_5 con SHA2-256
BLOCK_ID = 0x7109871a     # id del blocco firma v2
MAGIC = b'APK Sig Block 42'

cert_der = cert.public_bytes(serialization.Encoding.DER)
pub_der = key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)

def lp(b):  # length-prefixed (uint32 LE)
    return struct.pack('<I', len(b)) + b

def chunk_digests(section):
    out = []
    for i in range(0, len(section), 1 << 20):
        c = section[i:i + (1 << 20)]
        out.append(hashlib.sha256(b'\xa5' + struct.pack('<I', len(c)) + c).digest())
    return out

def make(signing_block_size):
    """Android, verificando, rimette nell'EOCD l'offset dell'INIZIO del blocco
    firma (cioè il vecchio offset della directory centrale): quindi l'impronta
    si calcola sull'EOCD originale, mentre nel file scritto l'offset punta
    alla directory spostata dopo il blocco."""
    new_cd_off = cd_off + signing_block_size
    eocd_new = bytearray(eocd); struct.pack_into('<I', eocd_new, 16, new_cd_off); eocd_new = bytes(eocd_new)
    chunks = chunk_digests(entries) + chunk_digests(cd) + chunk_digests(eocd)
    digest = hashlib.sha256(b'\x5a' + struct.pack('<I', len(chunks)) + b''.join(chunks)).digest()
    digests = lp(lp(struct.pack('<I', SIG_ALG) + lp(digest)))
    certs = lp(lp(cert_der))
    attrs = lp(b'')
    signed_data = digests + certs + attrs
    signature = key.sign(signed_data, padding.PKCS1v15(), hashes.SHA256())
    signatures = lp(lp(struct.pack('<I', SIG_ALG) + lp(signature)))
    signer = lp(signed_data) + signatures + lp(pub_der)
    v2 = lp(lp(signer))
    pair = struct.pack('<Q', 4 + len(v2)) + struct.pack('<I', BLOCK_ID) + v2
    size_field = len(pair) + 8 + 16
    block = struct.pack('<Q', size_field) + pair + struct.pack('<Q', size_field) + MAGIC
    return block, eocd_new

block, eocd_new = make(0)
block, eocd_new = make(len(block))          # ora con l'offset corretto
assert len(block) == len(make(len(block))[0])
signed = entries + block + cd + eocd_new
open(out, 'wb').write(signed)

# ── verifica interna: rileggo il file e ricalcolo l'impronta ──
chk = open(out, 'rb').read()
e2 = chk.rfind(b'PK\x05\x06'); cd2_off = struct.unpack('<I', chk[e2 + 16:e2 + 20])[0]
assert chk[cd2_off - 16:cd2_off] == MAGIC and cd2_off == cd_off + len(block)
print('APK firmato (schema v2, chiave di prova) →', os.path.relpath(out), '%.2f MB' % (len(signed) / 1e6))
print('ATTENZIONE: solo per prove. Se sul telefono c\'è già Kalend con un\'altra firma, va prima disinstallata (si perdono i dati locali: fai un backup dall\'app).')
