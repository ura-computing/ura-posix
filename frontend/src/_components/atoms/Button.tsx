/** The one button of the app: 36 px (`md`), 32 px (`sm`) in tight rows, 44 px (`lg`) for a page's
 *  main action only. `isLoading`: spinner + `loadingText`, disabled. `ButtonLink`: the same look on a
 *  router link (a button that changes page). */
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { Link, type LinkProps } from "react-router-dom";

import { useT } from "@/i18n/I18nProvider";

import { buttonClass, type ButtonSize, type ButtonVariant } from "./buttonClass";
import { Spinner } from "./Spinner";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  /** Shown while `isLoading` (default « Chargement… »). */
  loadingText?: string;
  ref?: Ref<HTMLButtonElement>;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  loadingText,
  className,
  disabled,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  const t = useT();
  return (
    <button
      type={type}
      disabled={isLoading || disabled}
      aria-busy={isLoading || undefined}
      className={buttonClass(variant, size, className)}
      {...rest}
    >
      {isLoading && <Spinner />}
      {isLoading ? (loadingText ?? t("common.loading")) : children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: LinkProps & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}
