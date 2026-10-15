import subprocess,sys
for tool in ['run-unit.cjs','test-character.cjs','test-motion-contact.cjs','test-distance-performance.cjs','test-cache-quality.cjs','capture-motion.cjs']:
 print('CHECK',tool,flush=True)
 result=subprocess.run(['node','tools/'+tool])
 if result.returncode:sys.exit(result.returncode)
print('ALL FINAL CHECKS PASSED',flush=True)
