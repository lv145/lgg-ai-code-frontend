import type { CSSProperties } from 'vue'

const avatarColors = [
  '#6b7f2a',
  '#66bfa8',
  '#35d6c8',
  '#4f8fd9',
  '#8b6fd6',
  '#d96f9f',
  '#d9863d',
  '#3f9d69',
]

export const getAvatarText = (name?: string) => {
  const trimmedName = name?.trim()
  return trimmedName ? Array.from(trimmedName)[0] : '无'
}

export const getAvatarStyle = (name?: string): CSSProperties => {
  const trimmedName = name?.trim()
  const source = trimmedName || '无名'
  const hash = Array.from(source).reduce((total, char) => total + char.charCodeAt(0), 0)

  return {
    backgroundColor: avatarColors[hash % avatarColors.length],
    color: '#fff',
  }
}
