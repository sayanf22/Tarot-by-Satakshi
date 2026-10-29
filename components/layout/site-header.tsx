"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Ornament } from "@/components/ui/ornament";
import { cn } from "@/lib/cn";
import { navigation, site } from "@/lib/site";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ href, label, pathname }: { href: string; label: string; pathname: string }) {
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative py-2 text-[0.9rem] font-medium tracking-[0.03em] transition-colors hover:text-gold-800",
        "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-center after:bg-gold-500 after:transition-transform after:duration-300",
        active ? "text-gold-800 after:scale-x-100" : "text-ink after:scale-x-0 hover:after:scale-x-100",
      )}
    >
      {label}
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Keep the page behind the open menu from scrolling.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // A modal <dialog> traps focus and closes on Escape natively.
  function openMenu() {
    menuRef.current?.showModal();
    setOpen(true);
  }

  function closeMenu() {
    menuRef.current?.close();
  }

  const left = navigation.slice(0, 3);
  const right = navigation.slice(3);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-white/95 backdrop-blur-sm transition-[border-color,box-shadow] duration-300",
        scrolled ? "border-line shadow-[0_8px_30px_-24px_rgb(110_82_32/0.45)]" : "border-transparent",
      )}
    >
      <Container className="flex h-20 items-center justify-between lg:grid lg:grid-cols-[1fr_auto_1fr]">
        <nav aria-label="Main" className="hidden items-center gap-10 lg:flex">
          {left.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} />
          ))}
        </nav>

        <Wordmark />

        <div className="hidden items-center justify-end gap-10 lg:flex">
          {right.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} />
          ))}
          <ButtonLink href="/book" size="sm">
            Book a session
          </ButtonLink>
        </div>

        <button
          type="button"
          onClick={openMenu}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="-mr-2 flex size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-ivory lg:hidden"
        >
          <Menu className="size-6" strokeWidth={1.75} />
        </button>
      </Container>

      <dialog
        ref={menuRef}
        id="mobile-menu"
        aria-label="Menu"
        onClose={() => setOpen(false)}
        className="m-0 h-dvh max-h-none w-full max-w-none flex-col overflow-y-auto border-0 bg-white p-0 text-ink backdrop:bg-ink/30 open:flex lg:hidden"
      >
        <Container className="flex h-20 shrink-0 items-center justify-between">
          <Wordmark onClick={closeMenu} />
          <button
            type="button"
            onClick={closeMenu}
            autoFocus
            aria-label="Close menu"
            className="-mr-2 flex size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-champagne"
          >
            <X className="size-6" strokeWidth={1.75} />
          </button>
        </Container>

        <nav aria-label="Mobile" className="flex flex-1 flex-col items-center justify-center gap-7 py-10">
          {navigation.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMenu}
                aria-current={active ? "page" : undefined}
                className={cn("font-display text-4xl", active ? "text-gold-800" : "text-ink")}
              >
                {item.label}
              </Link>
            );
          })}
          <Ornament className="mt-2" />
          <ButtonLink href="/book" onClick={closeMenu} className="mt-2">
            Book a session
          </ButtonLink>
        </nav>

        <div className="shrink-0 pb-10 text-center text-sm text-ink-muted">
          <p>
            {site.hours.daysShort} · {site.hours.time} {site.hours.timeZone}
          </p>
          <a href={site.phone.href} className="mt-1 inline-block font-semibold text-gold-800">
            {site.phone.display}
          </a>
        </div>
      </dialog>
    </header>
  );
}
