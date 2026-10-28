import { useState } from 'react'
import { useDocs } from '../lib/hooks'
import { DocEditor, RepeatList } from '../components/DocEditor'
import { SingleImage } from '../components/ImageUploader'
import { Field, Section } from '../components/ui'
import { BookOpen, Image, LayoutGrid, Quote, Shirt, Sparkles } from 'lucide-react'
import { RichField } from '../components/RichText'

interface Hero { imageUrl?: string; mobileImageUrl?: string; eyebrow?: string; heading: string; ctaLabel?: string; ctaHref?: string; secondaryLabel?: string; secondaryHref?: string }
interface Tile { title: string; subtitle?: string; imageUrl?: string; href: string; size?: 'large' | 'tall' | 'wide' | 'small' }
interface Home {
  hero: Hero; featuredCollections: Tile[]; featuredProductIds: string[]
  brandStory: { eyebrow?: string; heading?: string; body?: string; imageUrl?: string; points?: { title: string; text: string }[] }
  social: { imageUrl: string; href: string; alt?: string }[]; editorialMessage?: string
}

const defaults: Home = {
  hero: { heading: 'Designed to be remembered', eyebrow: 'The Edit', ctaLabel: 'Shop the Collection', ctaHref: '/shop', secondaryLabel: 'New Arrivals', secondaryHref: '/shop?sort=newest' },
  featuredCollections: [], featuredProductIds: [],
  brandStory: { eyebrow: 'Our Story', heading: '', body: '', points: [] }, social: [], editorialMessage: '',
}

export default function ContentPage() {
  const products = useDocs<{ name: string; status: string }>('products')
  const [filter, setFilter] = useState('')

  return (
    <DocEditor<Home> col="homepageContent" id="main" title="Homepage content" permission="content:write" defaults={defaults}
      subtitle="Everything on the storefront homepage and About page. Leave images empty to use the built-in placeholder artwork.">
      {(d, set) => (
        <>
          <Section title="Hero" icon={Sparkles} tone="rose" className="grid gap-4 sm:grid-cols-2">
            <SingleImage label="Desktop image (landscape, ≥1920px)" folder="content/hero" value={d.hero.imageUrl} onChange={(u) => set('hero', { ...d.hero, imageUrl: u })} />
            <SingleImage label="Mobile image (portrait)" folder="content/hero" value={d.hero.mobileImageUrl} onChange={(u) => set('hero', { ...d.hero, mobileImageUrl: u })} />
            {([['eyebrow', 'Small label'], ['heading', 'Headline'], ['ctaLabel', 'Primary button text'], ['ctaHref', 'Primary button link'], ['secondaryLabel', 'Secondary button text'], ['secondaryHref', 'Secondary button link']] as const).map(([k, l]) => (
              <Field key={k} label={l}><input className="field" value={d.hero[k] ?? ''} onChange={(e) => set('hero', { ...d.hero, [k]: e.target.value })} /></Field>
            ))}
          </Section>

          <Section title="Featured collections" hint="Up to 5 editorial tiles. If empty, your visible Collections are used." icon={LayoutGrid} tone="violet">
            <RepeatList<Tile> items={d.featuredCollections} onChange={(v) => set('featuredCollections', v)} max={5} addLabel="Add tile" blank={{ title: '', href: '/shop', size: 'small' }}
              render={(t, patch) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Title"><input className="field" value={t.title} onChange={(e) => patch({ title: e.target.value })} /></Field>
                  <Field label="Subtitle"><input className="field" value={t.subtitle ?? ''} onChange={(e) => patch({ subtitle: e.target.value })} /></Field>
                  <Field label="Link"><input className="field" value={t.href} onChange={(e) => patch({ href: e.target.value })} /></Field>
                  <Field label="Size"><select className="field" value={t.size ?? 'small'} onChange={(e) => patch({ size: e.target.value as Tile['size'] })}><option value="large">Large</option><option value="tall">Tall</option><option value="wide">Wide</option><option value="small">Small</option></select></Field>
                  <SingleImage label="Image" folder="content/tiles" value={t.imageUrl} onChange={(u) => patch({ imageUrl: u })} />
                </div>
              )} />
          </Section>

          <Section title="Featured products" icon={Shirt} tone="sky">
            <p className="mb-3 text-sm text-taupe-deep">Choose up to 8. If none are chosen, products marked “Featured” (then the newest) are shown. {d.featuredProductIds.length} selected.</p>
            <input className="field mb-3 max-w-xs" placeholder="Filter products" aria-label="Filter products" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <div className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
              {products.data.filter((p) => p.status === 'published' && p.name.toLowerCase().includes(filter.toLowerCase())).map((p) => {
                const on = d.featuredProductIds.includes(p.id)
                return (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="check" checked={on} disabled={!on && d.featuredProductIds.length >= 8}
                      onChange={(e) => set('featuredProductIds', e.target.checked ? [...d.featuredProductIds, p.id] : d.featuredProductIds.filter((x) => x !== p.id))} />{p.name}
                  </label>
                )
              })}
              {!products.data.some((p) => p.status === 'published') && <p className="text-sm text-taupe-deep">No published products yet.</p>}
            </div>
          </Section>

          <Section title="Brand story (homepage &amp; About)" hint="Only state facts you can stand behind — avoid unverified claims about manufacturing, sustainability, artisans or heritage." icon={BookOpen} tone="amber" className="grid gap-4 sm:grid-cols-2">
            <Field label="Small label"><input className="field" value={d.brandStory.eyebrow ?? ''} onChange={(e) => set('brandStory', { ...d.brandStory, eyebrow: e.target.value })} /></Field>
            <Field label="Heading"><input className="field" value={d.brandStory.heading ?? ''} onChange={(e) => set('brandStory', { ...d.brandStory, heading: e.target.value })} /></Field>
            <RichField label="Story" className="sm:col-span-2" minHeight="10rem" value={d.brandStory.body ?? ''} onChange={(v) => set('brandStory', { ...d.brandStory, body: v })} placeholder="Tell the Zebella story…" />
            <div className="sm:col-span-2"><SingleImage label="Image" folder="content/story" value={d.brandStory.imageUrl} onChange={(u) => set('brandStory', { ...d.brandStory, imageUrl: u })} /></div>
            <div className="sm:col-span-2">
              <span className="label">Highlights (design philosophy, detail, fabric, experience…)</span>
              <RepeatList<{ title: string; text: string }> items={d.brandStory.points ?? []} max={4} addLabel="Add highlight" blank={{ title: '', text: '' }} onChange={(v) => set('brandStory', { ...d.brandStory, points: v })}
                render={(p, patch) => <div className="grid gap-3"><Field label="Title"><input className="field" value={p.title} onChange={(e) => patch({ title: e.target.value })} /></Field><Field label="Text"><textarea rows={2} className="field" value={p.text} onChange={(e) => patch({ text: e.target.value })} /></Field></div>} />
            </div>
          </Section>

          <Section title="Editorial statement" icon={Quote} tone="emerald">
            <Field label="Shown beside the 3D emblem (and as a quote if there are no verified testimonials)"><input className="field" value={d.editorialMessage ?? ''} onChange={(e) => set('editorialMessage', e.target.value)} /></Field>
          </Section>

          <Section title="Social gallery" hint="Up to 6 images that you upload and link yourself (no Instagram scraping)." icon={Image} tone="rose">
            <RepeatList<{ imageUrl: string; href: string; alt?: string }> items={d.social} max={6} addLabel="Add image" blank={{ imageUrl: '', href: '' }} onChange={(v) => set('social', v)}
              render={(s, patch) => <div className="grid gap-3 sm:grid-cols-2"><SingleImage label="Image" folder="content/social" value={s.imageUrl} onChange={(u) => patch({ imageUrl: u })} /><div className="space-y-3"><Field label="Link"><input className="field" value={s.href} onChange={(e) => patch({ href: e.target.value })} /></Field><Field label="Alt text"><input className="field" value={s.alt ?? ''} onChange={(e) => patch({ alt: e.target.value })} /></Field></div></div>} />
          </Section>
        </>
      )}
    </DocEditor>
  )
}
