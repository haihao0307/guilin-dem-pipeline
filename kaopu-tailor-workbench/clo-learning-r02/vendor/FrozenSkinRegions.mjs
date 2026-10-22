/** Load the original r0434 semantic fields exported with this frozen person.
 * No fields are inferred, repainted or regenerated for this independent study.
 * The retained CommonSkinLayer shader consumes these same array values.
 */
export function buildSkinRegions(model) {
  const source = model?.skinFields;
  const count = model?.vertexCount;
  if (!source || !Number.isInteger(count) || count <= 0) {
    throw new Error('原人物缺少冻结的皮肤语义字段。');
  }
  const fields = {};
  for (const [name, components] of [['rest', 3], ['regions', 4], ['extra', 4], ['types', 1]]) {
    const values = source[name];
    if (!values || values.length !== count * components) {
      throw new Error('原人物皮肤字段长度不符：' + name);
    }
    const typed = Float32Array.from(values);
    if (!typed.every(Number.isFinite)) throw new Error('原人物皮肤字段含无效数值：' + name);
    fields[name] = typed;
  }
  fields.report = structuredClone(source.report || {});
  return fields;
}
