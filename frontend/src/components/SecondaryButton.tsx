import { Button } from "./Button";

export function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { full?: boolean }) {
  const { full, className, ...rest } = props as any;
  return (
    <Button
      {...rest}
      variant="secondary"
      className={["rounded-xl", full ? "w-full" : "", className ?? ""].join(" ")}
    />
  );
}
