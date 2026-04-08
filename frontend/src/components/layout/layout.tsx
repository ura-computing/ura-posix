"use client";

import { Header } from "@/components/layout/header";

import { TopLoadingBar } from "@/components/topLoadingBar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/utils/cn";
import type { PropsWithChildren } from "react";
import { Sidebar } from "./sidebar";

export function Layout({ children }: PropsWithChildren) {
  return (
    <>
      <TopLoadingBar />
      <SidebarProvider data-pg-sidebar="">
        <Sidebar />
        <SidebarInset>
          <Header />
          <main
            className={cn(
              "@container/main",
              "relative",
              "w-full",
              "flex",
              "flex-col",
              "flex-1",
              "px-4",
              "pt-4",
              "pb-6",
              "md:px-6",
              "md:pt-6",
              "md:pb-10"
            )}
          >
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}

Layout.displayName = "Layout";
