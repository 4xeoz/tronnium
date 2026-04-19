"use client";

import { Card } from "@/components/security/SecurityUI";
import { Button } from "@/components/ui/Button";

export function EmptyStateSec({ onScan }: { onScan: () => void }) {
  return (
    <Card className="p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success-bg flex items-center justify-center border border-success-border">
        <svg className="w-8 h-8 text-success-text" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
      </div>
      <h3 className="text-[22px] font-bold text-text-primary tracking-[-0.3px] mb-2">All Clear</h3>
      <p className="text-text-secondary mb-6 max-w-md mx-auto text-sm">No vulnerabilities found in this environment. Run a scan to check for the latest threats.</p>
      <Button onClick={onScan}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        Start Security Scan
      </Button>
    </Card>
  );
}
