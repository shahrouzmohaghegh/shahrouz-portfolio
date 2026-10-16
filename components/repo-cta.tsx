import styles from "./repo-cta.module.css";

export type RepoCtaProps = {
  // The project's repository, from its Evidence Item.
  readonly href: string;
  // The caps word above the title ("Repository") and the title itself; the
  // route passes them, since a component never imports evidence copy.
  readonly kicker: string;
  readonly title: string;
  // The panel under the header, or its repeat at the foot of the rail.
  readonly variant: "panel" | "rail";
};

// The one accessible name both variants share, so a screen reader's link
// list shows one destination twice, not two different links. It holds every
// visible word, kicker first, in order (WCAG 2.5.3 Label in Name, which the
// axe audit in scripts/check-a11y.mts enforces), so speech input can use the
// words on screen.
export const repoCtaName = (kicker: string, title: string, href: string): string => `${kicker}: ${title} ${href}`;

// {components.repo-cta} and {components.repo-cta-rail} (Story 3.5,
// DESIGN.md and EXPERIENCE.md): a solid accent fill that is one <a>, not a
// panel holding a link, so there is one tab stop and one target. The panel
// shows the full URL as text, so the destination is legible before the
// click and in print. The rail repeat is the same anchor at rail scale.
// Accent fills are allowed on /projects/[slug] only; app/projects/projects
// .test.tsx fails if these classes reach any other route. Both sit on light
// grounds, so both keep {colors.focus-ring} (styles/focus.css).
export function RepoCta({ href, kicker, title, variant }: RepoCtaProps) {
  const rail = variant === "rail";
  return (
    <a href={href} aria-label={repoCtaName(kicker, title, href)} className={rail ? styles.rail : styles.panel}>
      {/* The spaces keep the words apart in the text an accessibility check
          compares with the accessible name; the spans are blocks, so they
          draw nothing. */}
      <span className={rail ? styles.railKicker : styles.kicker}>{kicker}</span>{" "}
      <span className={rail ? styles.railTitle : styles.title}>{title}</span>
      {!rail && (
        <>
          {" "}
          <span className={styles.url}>{href}</span>
        </>
      )}
    </a>
  );
}
