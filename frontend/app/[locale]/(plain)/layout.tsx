import { MiniFooter, PlainHeader } from "@/components/AppChrome";

export default function PlainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PlainHeader />
      {children}
      <MiniFooter />
    </>
  );
}
