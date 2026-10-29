"use client";
import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="top-center"
      toastOptions={{ classNames: { toast: "!border-2 !border-ink !bg-white !text-ink !rounded-xl !font-sans" } }}
      {...props}
    />
  );
}
export { Toaster };
