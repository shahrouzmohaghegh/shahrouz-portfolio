import styles from "./email-address.module.css";

// The email address as link text, lightly obfuscated (the footer since Story
// 2.2, Contact since Story 3.8): the visible "@" is hidden from assistive
// technology, which reads a visually hidden one instead, so the address is
// never one contiguous text run in the HTML, and a screen reader still reads
// it whole. The caller wraps it in the mailto: link.
export function EmailAddress({ address }: { address: string }) {
  const at = address.indexOf("@");
  return (
    <>
      {address.slice(0, at)}
      <span aria-hidden="true">@</span>
      <span className={styles.visuallyHidden}>@</span>
      {address.slice(at + 1)}
    </>
  );
}
