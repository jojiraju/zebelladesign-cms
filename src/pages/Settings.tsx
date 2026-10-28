import { DocEditor, RepeatList } from '../components/DocEditor'
import { Field, Section, Switch } from '../components/ui'
import { HelpCircle, Mail, Megaphone, Phone, ScrollText, Truck } from 'lucide-react'
import { RichField } from '../components/RichText'
import { toPaise, toRupees } from '../lib/util'

interface Method { id: string; label: string; fee: number; freeAbove?: number | null; eta: string }
interface Settings {
  announcements: { id: string; text: string; href?: string }[]
  shippingMethods: Method[]; taxInclusiveRatePercent: number
  contact: { email?: string; phone?: string; address?: string; hours?: string }
  social: { instagram?: string; facebook?: string; pinterest?: string; youtube?: string }
  footer: { description?: string }
  newsletter: { enabled: boolean; heading?: string; consent?: string }
  policies: { shipping?: string; returns?: string; privacy?: string; terms?: string }
  faq: { q: string; a: string }[]
  pincodeCheck: { enabled: boolean; note?: string }
}

const defaults: Settings = {
  announcements: [], shippingMethods: [{ id: 'standard', label: 'Standard Delivery', fee: 9900, freeAbove: 299900, eta: '5–8 business days' }],
  taxInclusiveRatePercent: 5, contact: {}, social: {}, footer: {},
  newsletter: { enabled: true, heading: 'Join the Zebella list', consent: 'By subscribing you agree to receive occasional emails about new collections. Unsubscribe anytime.' },
  policies: {}, faq: [], pincodeCheck: { enabled: false },
}

export default function SettingsPage() {
  return (
    <DocEditor<Settings> col="settings" id="store" title="Store settings" permission="content:write" defaults={defaults}
      subtitle="Announcements, shipping, tax, contact details, footer, policies and FAQs. Policies are your own legal text — nothing is pre-written.">
      {(d, set) => (
        <>
          <Section title="Announcement bar" icon={Megaphone} tone="amber">
            <RepeatList items={d.announcements} max={5} addLabel="Add message" blank={{ id: '', text: '', href: '' }} onChange={(v) => set('announcements', v.map((a, i) => ({ ...a, id: a.id || `a${Date.now()}${i}` })))}
              render={(a, patch) => <div className="grid gap-3 sm:grid-cols-2"><Field label="Message"><input className="field" value={a.text} onChange={(e) => patch({ text: e.target.value })} /></Field><Field label="Link (optional)"><input className="field" value={a.href ?? ''} onChange={(e) => patch({ href: e.target.value })} /></Field></div>} />
          </Section>

          <Section title="Shipping &amp; tax" hint="Amounts are in ₹. The server calculates shipping from these rules at checkout." icon={Truck} tone="sky">
            <RepeatList<Method> items={d.shippingMethods} max={4} addLabel="Add method" blank={{ id: '', label: '', fee: 0, freeAbove: null, eta: '' }}
              onChange={(v) => set('shippingMethods', v.map((m, i) => ({ ...m, id: m.id || `m${Date.now()}${i}` })))}
              render={(m, patch) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name"><input className="field" value={m.label} onChange={(e) => patch({ label: e.target.value })} /></Field>
                  <Field label="Delivery estimate"><input className="field" value={m.eta} onChange={(e) => patch({ eta: e.target.value })} /></Field>
                  <Field label="Fee (₹)"><input type="number" min={0} step="0.01" className="field" value={toRupees(m.fee)} onChange={(e) => patch({ fee: toPaise(e.target.value) })} /></Field>
                  <Field label="Free above (₹, optional)"><input type="number" min={0} step="0.01" className="field" value={toRupees(m.freeAbove)} onChange={(e) => patch({ freeAbove: e.target.value === '' ? null : toPaise(e.target.value) })} /></Field>
                </div>
              )} />
            <div className="mt-4 max-w-xs"><Field label="GST % already included in prices" hint="Shown to customers as 'includes ₹x GST'. Use 0 to hide."><input type="number" min={0} max={50} step="0.5" className="field" value={d.taxInclusiveRatePercent} onChange={(e) => set('taxInclusiveRatePercent', Number(e.target.value) || 0)} /></Field></div>
            <div className="mt-4"><Switch checked={d.pincodeCheck.enabled} onChange={(v) => set('pincodeCheck', { ...d.pincodeCheck, enabled: v })} label="Show a PIN-code delivery box on product pages" /></div>
            {d.pincodeCheck.enabled && <div className="mt-3 max-w-lg"><Field label="Message shown after a valid PIN" hint="No courier API is connected, so this is a fixed message."><input className="field" value={d.pincodeCheck.note ?? ''} onChange={(e) => set('pincodeCheck', { ...d.pincodeCheck, note: e.target.value })} /></Field></div>}
          </Section>

          <Section title="Contact &amp; social" hint="Only enter real details — empty fields are simply not shown." icon={Phone} tone="emerald" className="grid gap-4 sm:grid-cols-2">
            <Field label="Email"><input type="email" className="field" value={d.contact.email ?? ''} onChange={(e) => set('contact', { ...d.contact, email: e.target.value })} /></Field>
            <Field label="Phone"><input className="field" value={d.contact.phone ?? ''} onChange={(e) => set('contact', { ...d.contact, phone: e.target.value })} /></Field>
            <Field label="Business address" className="sm:col-span-2"><textarea rows={3} className="field" value={d.contact.address ?? ''} onChange={(e) => set('contact', { ...d.contact, address: e.target.value })} /></Field>
            <Field label="Opening hours"><input className="field" value={d.contact.hours ?? ''} onChange={(e) => set('contact', { ...d.contact, hours: e.target.value })} /></Field>
            <span />
            {(['instagram', 'facebook', 'pinterest', 'youtube'] as const).map((k) => (
              <Field key={k} label={`${k[0].toUpperCase()}${k.slice(1)} URL`}><input type="url" className="field" value={d.social[k] ?? ''} onChange={(e) => set('social', { ...d.social, [k]: e.target.value })} /></Field>
            ))}
          </Section>

          <Section title="Footer &amp; newsletter" icon={Mail} tone="violet" className="grid gap-4">
            <Field label="Footer description"><textarea rows={2} className="field" value={d.footer.description ?? ''} onChange={(e) => set('footer', { description: e.target.value })} /></Field>
            <Switch checked={d.newsletter.enabled} onChange={(v) => set('newsletter', { ...d.newsletter, enabled: v })} label="Show newsletter signup" />
            <Field label="Newsletter heading"><input className="field" value={d.newsletter.heading ?? ''} onChange={(e) => set('newsletter', { ...d.newsletter, heading: e.target.value })} /></Field>
            <Field label="Consent text"><textarea rows={2} className="field" value={d.newsletter.consent ?? ''} onChange={(e) => set('newsletter', { ...d.newsletter, consent: e.target.value })} /></Field>
          </Section>

          <Section title="Policies" hint="Use the toolbar for headings, lists and links. Have these reviewed for your business before publishing." icon={ScrollText} tone="rose" className="grid gap-4">
            {([['shipping', 'Shipping policy'], ['returns', 'Returns & refunds'], ['privacy', 'Privacy policy'], ['terms', 'Terms & conditions']] as const).map(([k, l]) => (
              <RichField key={k} label={l} minHeight="12rem" value={d.policies[k] ?? ''} onChange={(v) => set('policies', { ...d.policies, [k]: v })} placeholder={`Write your ${l.toLowerCase()}…`} />
            ))}
          </Section>

          <Section title="FAQs" icon={HelpCircle} tone="amber">
            <RepeatList items={d.faq} addLabel="Add question" blank={{ q: '', a: '' }} onChange={(v) => set('faq', v)}
              render={(f, patch) => <div className="grid gap-3"><Field label="Question"><input className="field" value={f.q} onChange={(e) => patch({ q: e.target.value })} /></Field><RichField label="Answer" minHeight="5rem" value={f.a} onChange={(v) => patch({ a: v })} placeholder="Write the answer…" /></div>} />
          </Section>
        </>
      )}
    </DocEditor>
  )
}
