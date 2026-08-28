const fs = require('node:fs')
const path = require('node:path')
// 修复OpenAPI生成的long类型为string
const typingsPath = path.resolve(__dirname, '../src/api/typings.d.ts')
const longIdFields = ['id', 'userId', 'appId', 'parentId', 'inviteUser']
// 检查typings文件是否存在
if (!fs.existsSync(typingsPath)) {
  throw new Error(`typings file not found: ${typingsPath}`)
}
// 读取typings文件内容
let content = fs.readFileSync(typingsPath, 'utf8')
// 替换long类型为string
for (const field of longIdFields) {
  // 替换可选字段long类型为string
  const optionalFieldPattern = new RegExp(`(\\b${field}\\?:\\s*)number\\b`, 'g')
  // 替换必填字段long类型为string
  const requiredFieldPattern = new RegExp(`(\\b${field}:\\s*)number\\b`, 'g')
  // 替换long类型为string
  content = content
    .replace(optionalFieldPattern, '$1string')
    .replace(requiredFieldPattern, '$1string')
}
// 替换BaseResponseLong类型为string
content = content.replace(
  /(type BaseResponseLong = \{\s*code\?: number;\s*data\?: )number(\s*;\s*message\?: string;\s*\};)/,
  '$1string$2',
)
// 写入修复后的typings文件内容
fs.writeFileSync(typingsPath, content)
console.log('Fixed OpenAPI long id typings as string.')
