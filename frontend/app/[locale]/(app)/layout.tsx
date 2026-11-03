import { AppHeader, MiniFooter } from "@/components/AppChrome";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      {children}
      <MiniFooter />
    </>
  );
}
