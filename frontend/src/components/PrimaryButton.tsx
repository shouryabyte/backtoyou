import { Button } from "./Button";

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { full?: boolean }) {
  const { full, className, ...rest } = props as any;
  return (
    <Button
      {...rest}
      className={[
        "rounded-xl",
        full ? "w-full" : "",
        className ?? ""
      ].join(" ")}
    />
  );
}
