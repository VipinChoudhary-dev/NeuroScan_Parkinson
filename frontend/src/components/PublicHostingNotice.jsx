import { CloudMoon, Mail } from 'lucide-react';
import { IS_PUBLIC_PREVIEW } from '../config/deployment';

export default function PublicHostingNotice() {
  if (!IS_PUBLIC_PREVIEW) return null;

  return <aside className="public-hosting-note no-print" role="status">
    <CloudMoon size={24} aria-hidden="true" />
    <div>
      <strong>A quick note from the student behind NeuroScan.</strong>
      <p>NeuroScan’s three ML models need a server I can’t afford to keep running right now. So public analysis is taking a nap and won’t work for now. You can still explore the full site, prepare your files, and review the research—and I’ll bring live analysis back when my wallet catches up. 😅</p>
      <a href="mailto:vipinchoudhary0911@gmail.com?subject=Hello%20from%20NeuroScan"><Mail size={14} /> Say hi: vipinchoudhary0911@gmail.com <span aria-hidden="true">↗</span></a>
    </div>
  </aside>;
}
