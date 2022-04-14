import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { get, set } from '../storage/kv-storage'

declare global {
  interface Event {
    payload?: any
    client?: any
  }
}

export interface ECModuleSettings {
  [key: string]: any
}

type ECModuleConfig = string | ECModuleSettings

const EXTS = ['.ts', '.js', '.mts', '.mjs']
export class ECWeb extends EventTarget {
  modules: ECModuleConfig[]
  trackPath: string
  systemEventsPath: string
  sourcedScript: string
  requiredSnippets: string[]
  set: (key: string, value: any) => boolean
  get: (key: string) => any

  constructor(Context: {
    set?: (key: string, value: any) => boolean
    get?: (key: string) => any
    modules: ECModuleConfig[]
    trackPath: string
    systemEventsPath: string
  }) {
    super()
    this.sourcedScript = "console.log('ecweb script is sourced again')"
    this.requiredSnippets = ['track']
    this.trackPath = Context.trackPath
    this.systemEventsPath = Context.systemEventsPath
    this.set = Context.set || set
    this.get = Context.get || get
    this.modules = Context.modules
    this.initScript()
  }

  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    if (!this.requiredSnippets.includes(type)) {
      this.requiredSnippets.push(type)
    }
    super.addEventListener(type, callback, options)
  }

  async initScript() {
    for (const mod of this.modules) {
      let tool
      let toolPath = ''
      let moduleName = ''
      let moduleSettings = {}
      if (typeof mod === 'object') {
        ;[moduleName] = Object.keys(mod)
        moduleSettings = mod[moduleName]
      } else {
        moduleName = mod
      }
      for (const ext of EXTS) {
        toolPath = path.join(__dirname, `../modules/${moduleName}/index${ext}`)
        if (existsSync(toolPath)) {
          tool = ext === '.mjs' ? await import(toolPath) : require(toolPath)
          break
        }
      }

      if (tool) {
        try {
          console.info('loading tool', moduleName)
          await tool.default(this, moduleSettings)
        } catch (error) {
          console.error('Error loading tool', toolPath, tool, error)
        }
      }
    }
  }

  getInjectedScript() {
    let injectedScript = ''
    for (const snippet of this.requiredSnippets) {
      const snippetPath = `browser/${snippet}.js`
      if (existsSync(snippetPath)) {
        injectedScript += readFileSync(snippetPath)
          .toString()
          .replace('TRACK_PATH', this.trackPath)
          .replace('SYSTEM_EVENTS_PATH', this.systemEventsPath)
      }
    }
    return injectedScript
  }
}
