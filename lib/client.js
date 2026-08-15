// dsh-web-search —— browser half: settings card (settings.plugin.item), structure and visuals modeled
// after dsh-web-search-tavily.
// Configures piwa_search: the default search engine toggle (PIWA_SEARCH_ENABLED) plus
// SEARXNG_BASE_URL / TAVILY_API_KEY / BRAVE_API_KEY (written to the credentials service, which is
// exactly where the host getKey() reads from). Unconfigured providers are skipped automatically;
// DuckDuckGo is the zero-config fallback.
window.__ModuleLoader__.load({
  id: 'dsh-web-search',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    const React = require('react')
    const clientRuntime = require('@deepseek-ai/dsh-client-runtime/client')

    const REFS = [
      { key: 'searxng', ref: 'SEARXNG_BASE_URL', secret: false, label: 'SearXNG base URL', hint: 'Base URL of your self-hosted SearXNG (e.g. https://search.example.com); used with the highest priority when set' },
      { key: 'tavily', ref: 'TAVILY_API_KEY', secret: true, label: 'Tavily API Key', hint: 'Get one at https://app.tavily.com; skipped when unset' },
      { key: 'brave', ref: 'BRAVE_API_KEY', secret: true, label: 'Brave API Key', hint: 'Get one at https://brave.com/search/api/; skipped when unset' },
    ]
    const ENABLED_REF = 'PIWA_SEARCH_ENABLED'

    function injectCss() {
      if (typeof document === 'undefined') return () => {}
      const prev = document.querySelector('style[data-piwa-search-css]')
      if (prev) prev.remove()
      const tag = document.createElement('style')
      tag.setAttribute('data-piwa-search-css', '2')
      tag.textContent = [
        '.piwa_card{list-style:none;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-3);transition:border-color .16s,background .16s}',
        '.piwa_card:hover{border-color:var(--dsw-alias-label-dimmed)}',
        '.piwa_cardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}',
        '.piwa_head{width:100%;appearance:none;border:0;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px}',
        '.piwa_head:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}',
        '.piwa_headText{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}',
        '.piwa_name{font-size:15px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary)}',
        '.piwa_desc{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}',
        '.piwa_pending{flex:none;border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px;font-weight:500;white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary)}',
        '.piwa_chevron{flex:none;display:block;width:14px;height:14px;color:var(--dsw-alias-label-tertiary);transition:transform .16s}',
        '.piwa_chevronOpen{transform:rotate(180deg)}',
        '.piwa_body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}',
        '.piwa_field{display:flex;flex-direction:column;gap:6px;padding:12px 0}',
        '.piwa_field+.piwa_field{border-top:1px solid var(--dsw-alias-border-l2)}',
        '.piwa_fieldHead{display:flex;align-items:center;gap:8px}',
        '.piwa_label{flex:1;min-width:0;font-size:13px;font-weight:500;line-height:1.5;color:var(--dsw-alias-label-primary)}',
        '.piwa_badge{flex:none;border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px;white-space:nowrap;font-weight:500;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary)}',
        '.piwa_clear{flex:none;appearance:none;border:0;background:none;padding:0;font:inherit;font-size:12px;line-height:17px;color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap}',
        '.piwa_clear:hover:not(:disabled){color:var(--dsw-alias-label-primary)}',
        '.piwa_clear:disabled{opacity:.4;cursor:default}',
        '.piwa_clear:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
        '.piwa_hint{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}',
        '.piwa_input{height:34px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-3);font:inherit;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary)}',
        '.piwa_input:focus-visible{outline:none;border-color:var(--dsw-alias-brand-primary)}',
        '.piwa_input:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}',
        '.piwa_switch{flex:none;position:relative;width:36px;height:20px;cursor:pointer}',
        '.piwa_switchInput{position:absolute;inset:0;margin:0;opacity:0;cursor:pointer}',
        '.piwa_switchTrack{display:block;width:36px;height:20px;border-radius:999px;background:var(--dsw-alias-bg-module-platform);transition:background .16s}',
        '.piwa_switchTrack::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-label-primary);transition:transform .16s}',
        '.piwa_switchInput:checked+.piwa_switchTrack{background:var(--dsw-alias-brand-primary)}',
        '.piwa_switchInput:checked+.piwa_switchTrack::after{transform:translateX(16px);background:#fff}',
        '.piwa_switchInput:focus-visible+.piwa_switchTrack{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
        '.piwa_switchInput:disabled+.piwa_switchTrack{opacity:.4}',
        '.piwa_footer{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:12px 0 4px;border-top:1px solid var(--dsw-alias-border-l2)}',
        '.piwa_failed{flex:1;min-width:0;margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-error)}',
        '.piwa_discard,.piwa_save{appearance:none;border:1px solid transparent;border-radius:8px;padding:5px 14px;font:inherit;font-size:13px;line-height:1.5;cursor:pointer}',
        '.piwa_discard{border-color:var(--dsw-alias-border-l2);background:none;color:var(--dsw-alias-label-secondary)}',
        '.piwa_discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}',
        '.piwa_save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}',
        '.piwa_discard:disabled,.piwa_save:disabled{opacity:.4;cursor:default}',
        '.piwa_discard:focus-visible,.piwa_save:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      ].join('')
      document.head.appendChild(tag)
      return () => tag.remove()
    }

    class PiwaCardController {
      constructor(api) {
        this.api = api
        this.enabled = false
        this.enabledWritable = true
        this.draftEnabled = false
        this.fields = REFS.map((f) => ({ ...f, configured: false, writable: true, draft: '', clear: false }))
        this.saving = false
        this.failed = false
        this.store = clientRuntime.createSnapshotStore(this.projection())
        this.refresh()
      }

      projection() {
        const dirty = this.draftEnabled !== this.enabled || this.fields.some((f) => f.draft.trim() !== '' || f.clear)
        return {
          enabled: this.draftEnabled,
          enabledWritable: this.enabledWritable,
          fields: this.fields.map((f) => ({ key: f.key, label: f.label, hint: f.hint, secret: f.secret, configured: f.configured, writable: f.writable, draft: f.draft, clear: f.clear })),
          dirty,
          saving: this.saving,
          failed: this.failed,
        }
      }

      publish() { this.store.set(this.projection()) }

      async refresh() {
        try {
          const refs = REFS.map((f) => f.ref).concat([ENABLED_REF])
          const response = await this.api.credentials.describe({ refs })
          const map = response.result.ok ? (response.result.value.credentials || {}) : {}
          // Toggle: presence of the PIWA_SEARCH_ENABLED credential means on
          const en = map[ENABLED_REF] || { configured: false, writable: true }
          this.enabled = !!en.configured
          this.enabledWritable = en.writable !== false
          this.draftEnabled = this.enabled
          for (const f of this.fields) {
            const info = map[f.ref] || { configured: false, writable: true }
            f.configured = !!info.configured
            f.writable = info.writable !== false
            f.draft = ''
            f.clear = false
          }
        } catch { /* keep current state */ }
        this.saving = false
        this.failed = false
        this.publish()
      }

      inject() {
        return {
          hooks: { piwaCard: this.store },
          setEnabled: (value) => {
            this.draftEnabled = value
            this.failed = false
            this.publish()
          },
          setField: (key, text) => {
            const f = this.fields.find((x) => x.key === key)
            if (f) { f.draft = text; f.clear = false; this.failed = false; this.publish() }
          },
          stageClear: (key) => {
            const f = this.fields.find((x) => x.key === key)
            if (f) { f.draft = ''; f.clear = true; this.failed = false; this.publish() }
          },
          discard: () => { this.refresh() },
          save: () => this.save(),
        }
      }

      async save() {
        if (this.saving) return
        this.saving = true
        this.failed = false
        this.publish()
        try {
          if (this.enabledWritable) {
            if (this.draftEnabled) await this.api.credentials.set({ ref: ENABLED_REF, value: 'true' })
            else await this.api.credentials.unset({ ref: ENABLED_REF })
          }
          for (const f of this.fields) {
            if (!f.writable) continue
            const value = f.draft.trim()
            if (value) await this.api.credentials.set({ ref: f.ref, value })
            else if (f.clear) await this.api.credentials.unset({ ref: f.ref })
          }
          await this.refresh()
        } catch {
          this.failed = true
          this.saving = false
          this.publish()
        }
      }
    }

    function PiwaCard(props) {
      const e = React.createElement
      const state = props.usePiwaCard((s) => s)
      const t = props.t
      const [open, setOpen] = React.useState(false)
      const blocked = !state.dirty || state.saving
      return e('li', { className: open ? 'piwa_card piwa_cardOpen' : 'piwa_card' },
        e('button', {
          type: 'button', className: 'piwa_head', 'aria-expanded': open,
          onClick: () => setOpen(!open),
        },
          e('span', { className: 'piwa_headText' },
            e('span', { className: 'piwa_name' }, t ? t('title') : 'Web access (piwa)'),
            e('span', { className: 'piwa_desc' }, t ? t('description') : 'Search fallback: SearXNG → Tavily → Brave → keyless DuckDuckGo'),
          ),
          state.dirty ? e('span', { className: 'piwa_pending' }, t ? t('unsaved') : 'Unsaved') : null,
          e('svg', { className: open ? 'piwa_chevron piwa_chevronOpen' : 'piwa_chevron', width: 14, height: 14, viewBox: '0 0 14 14', fill: 'none', xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': true },
            e('path', { d: 'M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z', fill: 'currentColor' }),
          ),
        ),
        open ? e('div', { className: 'piwa_body' },
          // Default search engine toggle
          e('div', { className: 'piwa_field' },
            e('div', { className: 'piwa_fieldHead' },
              e('span', { className: 'piwa_label' }, t ? t('enable') : 'Use piwa as the default search engine (off = official DeepSeek)'),
              e('label', { className: 'piwa_switch' },
                e('input', {
                  className: 'piwa_switchInput', type: 'checkbox', role: 'switch',
                  'aria-checked': state.enabled, checked: state.enabled,
                  disabled: !state.enabledWritable,
                  onChange: (ev) => props.setEnabled(ev.target.checked),
                }),
                e('span', { className: 'piwa_switchTrack', 'aria-hidden': true }),
              ),
            ),
          ),
          // Key fields
          state.fields.map((f) => e('div', { key: f.key, className: 'piwa_field' },
            e('div', { className: 'piwa_fieldHead' },
              e('span', { className: 'piwa_label' }, f.label),
              e('span', { className: 'piwa_badge' },
                f.clear
                  ? (t ? t('willClear') : 'Will clear')
                  : f.configured
                    ? (t ? t('configured') : 'Configured')
                    : (t ? t('notConfigured') : 'Not set')),
              f.configured && f.writable && !f.clear
                ? e('button', { type: 'button', className: 'piwa_clear', disabled: state.saving, onClick: () => props.stageClear(f.key) }, t ? t('clear') : 'Clear')
                : null,
            ),
            e('input', {
              className: 'piwa_input',
              type: f.secret ? 'password' : 'text',
              placeholder: f.clear
                ? (t ? t('clearPlaceholder') : 'Will be cleared on save.')
                : f.configured
                  ? (t ? t('keepPlaceholder') : 'Leave blank to keep current value.')
                  : (t ? t('emptyPlaceholder') : 'Optional. Leave blank to skip.'),
              value: f.draft,
              disabled: !f.writable,
              onChange: (ev) => props.setField(f.key, ev.target.value),
            }),
            e('p', { className: 'piwa_hint' }, f.hint),
          )),
          e('div', { className: 'piwa_footer' },
            state.failed ? e('p', { className: 'piwa_failed' }, t ? t('saveFailed') : 'Save failed') : null,
            e('button', { type: 'button', className: 'piwa_discard', disabled: blocked, onClick: props.discard }, t ? t('discard') : 'Discard'),
            e('button', { type: 'button', className: 'piwa_save', disabled: blocked, onClick: props.save }, state.saving ? (t ? t('saving') : 'Saving…') : (t ? t('save') : 'Save')),
          ),
        ) : null,
      )
    }

    const inject = ['slots', 'locale', 'connection', 'remote']

    function apply(ctx) {
      ctx.effect(() => injectCss(), 'dsh-web-search: styles')
      const en = {
        title: 'Web access (piwa)',
        description: 'Search fallback: SearXNG → Tavily → Brave → keyless DuckDuckGo',
        enable: 'Use piwa as the default search engine (off = official DeepSeek)',
        unsaved: 'Unsaved',
        configured: 'Configured',
        notConfigured: 'Not set',
        willClear: 'Will clear',
        clear: 'Clear',
        clearPlaceholder: 'Will be cleared on save.',
        keepPlaceholder: 'Leave blank to keep current value.',
        emptyPlaceholder: 'Optional. Leave blank to skip.',
        saveFailed: 'Save failed',
        discard: 'Discard',
        saving: 'Saving…',
        save: 'Save',
      }
      ctx.effect(() => ctx.locale.register('dsh-web-search', { en }), 'dsh-web-search: locale')

      const { api } = ctx.get('connection')
      const card = new PiwaCardController(api)
      const remote = ctx.get('remote')
      if (remote) ctx.effect(() => remote.$on('credentials/updated', () => card.refresh()), 'dsh-web-search: creds watcher')

      ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
        name: 'settings.plugin.item',
        id: 'dsh-web-search',
        order: 22,
        locale: 'dsh-web-search',
        inject: () => card.inject(),
      }, PiwaCard))
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
