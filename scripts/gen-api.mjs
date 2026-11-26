// Generates plain-JavaScript API functions, documented with JSDoc, from the backend's OpenAPI document.
//
//   npm run api:gen              fetch from the running backend, then generate
//   npm run api:gen -- --offline generate from the committed openapi.json
//
// Output in src/api/generated/: schemas.js (a JSDoc @typedef per DTO and enum, no runtime code), one file
// per backend controller, and index.js. Never edit the generated files by hand; change the backend and regenerate.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'

// Swagger is served before the HTTPS redirect, so plain http avoids Node rejecting the dev certificate.
const SOURCE = process.env.API_DOCS_URL ?? 'http://localhost:5108/swagger/v1/swagger.json'
const SNAPSHOT = new URL('../openapi.json', import.meta.url)
const OUT = new URL('../src/api/generated/', import.meta.url)

async function loadDocument() {
  if (!process.argv.includes('--offline')) {
    try {
      const response = await fetch(SOURCE)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const doc = await response.json()
      await writeFile(SNAPSHOT, JSON.stringify(doc, null, 2) + '\n')
      console.log(`Fetched ${SOURCE}`)
      return doc
    } catch (error) {
      console.warn(`Could not fetch ${SOURCE} (${error.message}); using the committed openapi.json.`)
    }
  }
  return JSON.parse(await readFile(SNAPSHOT, 'utf8'))
}

const camel = (s) => s.replace(/[-_ ]+(\w)/g, (_, c) => c.toUpperCase()).replace(/^\w/, (c) => c.toLowerCase())
const isParam = (segment) => segment.startsWith('{')
const refName = (schema) => schema?.$ref?.split('/').pop()

/** JSDoc type expression for a JSON schema; `refs` collects the DTO names it mentions. */
function jsType(schema, refs = new Set()) {
  if (!schema) return '*'
  let type
  if (schema.$ref) { type = refName(schema); refs.add(type) }
  else if (schema.enum) type = schema.enum.map((v) => JSON.stringify(v)).join('|')
  else if (schema.type === 'array') type = `Array<${jsType(schema.items, refs)}>`
  else if (schema.type === 'integer' || schema.type === 'number') type = 'number'
  else if (schema.type === 'boolean') type = 'boolean'
  else if (schema.type === 'string') type = 'string'
  else if (schema.type === 'object' && schema.additionalProperties) type = `Object<string, ${jsType(schema.additionalProperties, refs)}>`
  else type = 'Object'
  return schema.nullable ? `(${type}|null)` : type
}

/** A @typedef block for one component schema: an enum union or an object with its properties. */
function renderTypedef(name, schema) {
  if (schema.enum) return `/** @typedef {${jsType(schema)}} ${name} */`
  const lines = [`/**`, ` * @typedef {Object} ${name}`]
  for (const [prop, propSchema] of Object.entries(schema.properties ?? {})) {
    const required = schema.required?.includes(prop)
    const note = propSchema.format ? ` ${propSchema.format}` : ''
    lines.push(` * @property {${jsType(propSchema)}} ${required ? prop : `[${prop}]`}${note}`)
  }
  return [...lines, ' */'].join('\n')
}

const jsonSchema = (content) => content?.['application/json']?.schema

function functionName(path, method, methodsOnPath, tag, clashes = new Set()) {
  const segments = path.split('/').slice(3) // drop '', 'api', resource
  const action = segments.filter((s) => !isParam(s)).map(camel).join('_').replace(/_(\w)/g, (_, c) => c.toUpperCase())
  if (!action) {
    const byId = segments.some(isParam)
    const verb = { get: byId ? 'getById' : 'list', post: 'create', put: 'update', patch: 'patch', delete: 'remove' }[method]
    // Two routes in one tag with the same verb (PUT /pricing-policies/{id}, PUT /fee-types/{id}): the one on another
    // resource names it.
    const resource = camel(path.split('/')[2])
    return clashes.has(verb) && resource !== camel(tag) ? verb + resource[0].toUpperCase() + resource.slice(1) : verb
  }
  // A sub-resource read by id (GET /handovers/{id}/photos/{photoId}) must not clash with its list or upload.
  if (method === 'get' && isParam(segments.at(-1))) return action + 'ById'
  // Same action reached by two verbs (e.g. GET and POST /access-codes): keep the verb so names stay unique.
  return methodsOnPath > 1 ? method + action[0].toUpperCase() + action.slice(1) : action
}

function renderOperation(path, method, op, methodsOnPath, refs, tag, clashes) {
  const name = functionName(path, method, methodsOnPath, tag, clashes)
  const params = op.parameters ?? []
  const pathParams = params.filter((p) => p.in === 'path')
  const queryParams = params.filter((p) => p.in === 'query')
  const multipart = op.requestBody?.content?.['multipart/form-data']
  const body = jsonSchema(op.requestBody?.content) ?? (multipart && { type: 'object', 'x-form-data': true })
  const okKey = Object.keys(op.responses).find((code) => code.startsWith('2'))
  const resultSchema = jsonSchema(op.responses[okKey]?.content)

  const doc = [`  /**`, `   * ${method.toUpperCase()} ${path}${op.summary ? ` — ${op.summary}` : ''}`]
  for (const p of pathParams) doc.push(`   * @param {${jsType(p.schema, refs)}} ${camel(p.name)}`)
  if (body) doc.push(`   * @param {${multipart ? 'FormData' : jsType(body, refs)}} body`)
  if (queryParams.length) doc.push(`   * @param {{ ${queryParams.map((p) => `${p.name}?: ${jsType(p.schema, refs)}`).join(', ')} }} [params] query string`)
  doc.push(`   * @returns {Promise<${resultSchema ? jsType(resultSchema, refs) : 'void'}>}`, `   */`)

  const args = [...pathParams.map((p) => camel(p.name)), ...(body ? ['body'] : []), ...(queryParams.length ? ['params'] : [])]
  const url = '`' + path.replace(/\{(\w+)\}/g, (_, n) => '${' + camel(n) + '}') + '`'
  // The client defaults to JSON, and axios would serialise a FormData body to JSON under that header.
  const options = multipart ? ", { headers: { 'Content-Type': 'multipart/form-data' } }" : queryParams.length ? ', { params }' : ''
  const call = ['get', 'delete'].includes(method)
    ? `api.${method}(${url}${options})`
    : `api.${method}(${url}, ${body ? 'body' : 'undefined'}${options})`

  return { name, code: `${doc.join('\n')}\n  ${name}: (${args.join(', ')}) =>\n    ${call}.then((r) => r.data),` }
}

const doc = await loadDocument()
await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })

const header = '// Generated by scripts/gen-api.mjs from the backend OpenAPI document. Do not edit.\n'
const schemas = Object.entries(doc.components?.schemas ?? {})
await writeFile(new URL('schemas.js', OUT),
  `${header}// Request and response shapes, for editor hints only; this module has no runtime code.\n\n` +
    schemas.map(([n, s]) => renderTypedef(n, s)).join('\n\n') + '\n\nexport {}\n')

// Plain names used more than once inside a tag, so functionName can tell them apart.
const seen = new Map()
for (const [path, item] of Object.entries(doc.paths)) {
  const methods = Object.keys(item).filter((m) => ['get', 'post', 'put', 'patch', 'delete'].includes(m))
  for (const method of methods) {
    const key = `${item[method].tags?.[0] ?? 'Misc'} ${functionName(path, method, methods.length, '')}`
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }
}
const clashesIn = (tag) => new Set([...seen].filter(([k, n]) => n > 1 && k.startsWith(`${tag} `)).map(([k]) => k.slice(tag.length + 1)))

const byTag = new Map()
for (const [path, item] of Object.entries(doc.paths)) {
  const methods = Object.keys(item).filter((m) => ['get', 'post', 'put', 'patch', 'delete'].includes(m))
  for (const method of methods) {
    const tag = item[method].tags?.[0] ?? 'Misc'
    if (!byTag.has(tag)) byTag.set(tag, { ops: [], refs: new Set() })
    const group = byTag.get(tag)
    group.ops.push(renderOperation(path, method, item[method], methods.length, group.refs, tag, clashesIn(tag)))
  }
}

const index = []
for (const [tag, { ops, refs }] of [...byTag].sort()) {
  const names = ops.map((o) => o.name)
  const duplicate = names.find((n, i) => names.indexOf(n) !== i)
  if (duplicate) throw new Error(`Two ${tag} operations both map to "${duplicate}"; extend functionName().`)

  const file = camel(tag)
  const typedefs = [...refs].sort().map((r) => `/** @typedef {import('./schemas.js').${r}} ${r} */`).join('\n')
  await writeFile(
    new URL(`${file}.js`, OUT),
    `${header}import { api } from '../axiosClient.js'\n\n${typedefs}${typedefs ? '\n\n' : ''}` +
      `export const ${file}Api = {\n${ops.map((o) => o.code).join('\n')}\n}\n`,
  )
  index.push(`export { ${file}Api } from './${file}.js'`)
}
await writeFile(new URL('index.js', OUT), header + index.join('\n') + '\n')

const total = [...byTag.values()].reduce((n, g) => n + g.ops.length, 0)
console.log(`Generated ${total} operations in ${byTag.size} files under src/api/generated/`)
