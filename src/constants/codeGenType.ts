export const CODE_GEN_TYPE_ENUM = {
  HTML: 'html',
  MULTI_FILE: 'multi_file',
  VUE_PROJECT: 'vue_project',
} as const

export const CODE_GEN_TYPE_OPTIONS = [
  {
    label: '原生 HTML 模式',
    value: CODE_GEN_TYPE_ENUM.HTML,
  },
  {
    label: '原生多文件模式',
    value: CODE_GEN_TYPE_ENUM.MULTI_FILE,
  },
  {
    label: 'Vue 项目模式',
    value: CODE_GEN_TYPE_ENUM.VUE_PROJECT,
  }
] as const

export const getCodeGenTypeLabel = (value?: string) => {
  return CODE_GEN_TYPE_OPTIONS.find((item) => item.value === value)?.label ?? value ?? '-'
}
