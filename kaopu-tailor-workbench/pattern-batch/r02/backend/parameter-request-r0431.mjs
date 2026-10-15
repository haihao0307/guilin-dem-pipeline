/** Parameter request identity and validation. No geometry or body rescaling. */
import {sha, stable} from './source-contract.mjs';
export function normalizedRequest(request = {}) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw Error('制版请求必须是参数对象。');
  const parameters = Object.hasOwn(request, 'parameters') ? request.parameters : Object.hasOwn(request, 'changedParameters') ? request.changedParameters : {};
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) throw Error('参数必须是键值对象。');
  return {parameters: structuredClone(parameters), easeCm: request.easeCm ?? 0, waistEaseCm: request.waistEaseCm ?? 0};
}
export function validateRequest(schema, request = {}) {
  const q = normalizedRequest(request), rules = new Map(schema.parameters.map(p => [p.path, p]));
  for (const [key, value] of Object.entries(q.parameters)) {
    const rule = rules.get(key);
    if (!rule) throw Error('未知原生参数：' + key);
    if (rule.type === 'bool' && typeof value !== 'boolean') throw Error('布尔参数类型不符：' + key);
    if (rule.choices && !rule.choices.some(v => v === value)) throw Error('原制版程序不支持此选项：' + key);
    if (rule.type === 'int' || rule.type === 'float') {
      if (typeof value !== 'number' || !Number.isFinite(value) ||
          (rule.type === 'int' && !Number.isInteger(value)) ||
          value < Math.min(...rule.samplingRange) || value > Math.max(...rule.samplingRange)) {
        throw Error('超出原生参数范围或类型：' + key);
      }
    }
  }
  for (const [key, max, label] of [['easeCm', 12, '胸臀加放量'], ['waistEaseCm', 6, '腰头加放量']]) {
    if (typeof q[key] !== 'number' || !Number.isFinite(q[key]) || q[key] < 0 || q[key] > max)
      throw Error(label + '必须是0至' + max + '厘米内的有限数值。');
  }
  return q;
}
export async function requestFromBinding(binding, schema) {
  if (!binding?.parameterRequestSHA256) return null;
  const request = validateRequest(schema, binding);
  if (await sha(stable(request)) !== binding.parameterRequestSHA256) throw Error('保存的参数与该成衣变体身份不符。');
  return request;
}
