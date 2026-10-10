import { SiteFrame } from "@/components/site-frame";
import styles from "./page.module.css";

export default function Home() {
  return (
    <SiteFrame current="/">
      <div className={styles.placeholder}>
        <h1 className={styles.name}>Shahrouz Mohaghegh</h1>
        <p className={styles.status}>This site is in progress.</p>
      </div>
    </SiteFrame>
  );
}
