export type VisualEditorElementInfo = {
  tagName: string
  id?: string
  className?: string
  text?: string
  pagePath: string
  selector: string
  rect: {
    width: number
    height: number
  }
}

const VISUAL_EDITOR_MESSAGE_TYPE = 'visual-editor:element-selected'
const VISUAL_EDITOR_STYLE_ID = 'visual-editor-style'
const HOVER_CLASS = 'visual-editor-hover'
const SELECTED_CLASS = 'visual-editor-selected'
const VISUAL_EDITOR_CLASSES = [HOVER_CLASS, SELECTED_CLASS]

const isElement = (target: EventTarget | null): target is Element => {
  const targetNode = target as Node | null
  const elementConstructor = targetNode?.ownerDocument?.defaultView?.Element
  return !!elementConstructor && target instanceof elementConstructor
}

const getIframeDocument = (iframe: HTMLIFrameElement) => {
  try {
    return iframe.contentDocument
  } catch {
    return null
  }
}

const getElementText = (element: Element) => {
  return (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120)
}

const getElementClassName = (element: Element) => {
  if (typeof element.className !== 'string') {
    return undefined
  }

  const className = element.className
    .split(/\s+/)
    .filter((item) => item && !VISUAL_EDITOR_CLASSES.includes(item))
    .join(' ')

  return className || undefined
}

const getElementSelector = (element: Element) => {
  const path: string[] = []
  let current: Element | null = element

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    const tagName = current.tagName.toLowerCase()
    if (current === current.ownerDocument.body || current === current.ownerDocument.documentElement) {
      path.unshift(tagName)
      break
    }

    if (current.id) {
      path.unshift(`${tagName}#${current.id}`)
      break
    }

    const parentElement: HTMLElement | null = current.parentElement
    if (!parentElement) {
      path.unshift(tagName)
      break
    }

    const sameTagSiblings = Array.from(parentElement.children).filter(
      (item): item is Element => item.tagName === current?.tagName,
    )
    const index = sameTagSiblings.indexOf(current)
    path.unshift(sameTagSiblings.length > 1 ? `${tagName}:nth-of-type(${index + 1})` : tagName)
    current = parentElement
  }

  return path.join(' > ')
}

const getElementPagePath = (element: Element) => {
  const location = element.ownerDocument.defaultView?.location
  if (!location) {
    return ''
  }
  const pageUrl = `${location.pathname}${location.search}${location.hash}`
  const indexPath = '#'
  const indexPosition = pageUrl.indexOf(indexPath)
  if (indexPosition === -1) {
    return pageUrl
  }
  return pageUrl.slice(indexPosition + indexPath.length) || '/'
}

const getElementInfo = (element: Element): VisualEditorElementInfo => {
  const rect = element.getBoundingClientRect()
  return {
    tagName: element.tagName.toLowerCase(),
    id: element.id || undefined,
    className: getElementClassName(element),
    text: getElementText(element) || undefined,
    pagePath: getElementPagePath(element),
    selector: getElementSelector(element),
    rect: {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
  }
}

const ensureVisualEditorStyle = (doc: Document) => {
  if (doc.getElementById(VISUAL_EDITOR_STYLE_ID)) {
    return
  }

  const style = doc.createElement('style')
  style.id = VISUAL_EDITOR_STYLE_ID
  style.textContent = `
    .${HOVER_CLASS} {
      outline: 2px dashed #1677ff !important;
      outline-offset: 2px !important;
      cursor: crosshair !important;
    }
    .${SELECTED_CLASS} {
      outline: 3px solid #0958d9 !important;
      outline-offset: 2px !important;
    }
  `
  doc.head.appendChild(style)
}

export class VisualEditorController {
  private iframe: HTMLIFrameElement
  private enabled = false
  private hoveredElement: Element | null = null
  private selectedElement: Element | null = null

  constructor(iframe: HTMLIFrameElement) {
    this.iframe = iframe
  }

  enable() {
    if (this.enabled) {
      return true
    }

    const doc = getIframeDocument(this.iframe)
    if (!doc) {
      return false
    }

    this.enabled = true
    ensureVisualEditorStyle(doc)
    doc.addEventListener('mouseover', this.handleMouseOver, true)
    doc.addEventListener('mouseout', this.handleMouseOut, true)
    doc.addEventListener('click', this.handleClick, true)
    return true
  }

  disable() {
    const doc = getIframeDocument(this.iframe)
    if (doc) {
      doc.removeEventListener('mouseover', this.handleMouseOver, true)
      doc.removeEventListener('mouseout', this.handleMouseOut, true)
      doc.removeEventListener('click', this.handleClick, true)
    }
    this.enabled = false
    this.clearHighlight()
  }

  destroy() {
    this.disable()
  }

  clearSelection() {
    this.selectedElement?.classList.remove(SELECTED_CLASS)
    this.selectedElement = null
  }

  private clearHighlight() {
    this.hoveredElement?.classList.remove(HOVER_CLASS)
    this.hoveredElement = null
    this.clearSelection()
  }

  private handleMouseOver = (event: MouseEvent) => {
    if (!this.enabled) {
      return
    }
    const target = event.target
    if (!isElement(target) || target === this.selectedElement) {
      return
    }

    this.hoveredElement?.classList.remove(HOVER_CLASS)
    this.hoveredElement = target
    target.classList.add(HOVER_CLASS)
  }

  private handleMouseOut = (event: MouseEvent) => {
    if (!this.enabled) {
      return
    }
    const target = event.target
    if (!isElement(target) || target !== this.hoveredElement) {
      return
    }

    target.classList.remove(HOVER_CLASS)
    this.hoveredElement = null
  }

  private handleClick = (event: MouseEvent) => {
    if (!this.enabled) {
      return
    }
    const target = event.target
    if (!isElement(target)) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    this.selectedElement?.classList.remove(SELECTED_CLASS)
    this.hoveredElement?.classList.remove(HOVER_CLASS)
    this.selectedElement = target
    target.classList.add(SELECTED_CLASS)

    this.iframe.contentWindow?.parent.postMessage(
      {
        type: VISUAL_EDITOR_MESSAGE_TYPE,
        payload: getElementInfo(target),
      },
      window.location.origin,
    )
  }
}

export const isVisualEditorElementMessage = (
  event: MessageEvent,
): event is MessageEvent<{
  type: typeof VISUAL_EDITOR_MESSAGE_TYPE
  payload: VisualEditorElementInfo
}> => {
  return event.origin === window.location.origin && event.data?.type === VISUAL_EDITOR_MESSAGE_TYPE
}
