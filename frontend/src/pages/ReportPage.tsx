import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { api } from "../lib/apiClient";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";

export default function ReportPage() {
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, reset } = useForm<any>({
    defaultValues: {
      type: "LOST",
      title: "",
      description: "",
      category: "",
      color: "",
      location: "",
      eventAt: new Date().toISOString(),
      privateBrand: "",
      privateUniqueMark: "",
      privateContents: ""
    }
  });

  async function onSubmit(values: any) {
    setSubmitting(true);
    try {
      const privateDetails = {
        brand: values.privateBrand,
        uniqueMark: values.privateUniqueMark,
        contents: values.privateContents
      };
      await api("/api/items", {
        method: "POST",
        body: JSON.stringify({
          type: values.type,
          title: values.title,
          description: values.description,
          category: values.category,
          color: values.color,
          location: values.location,
          eventAt: values.eventAt,
          privateDetails
        })
      });
      toast.success("Report submitted. Matches generated.");
      reset();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Card className="p-10">
        <h1 className="text-2xl font-bold text-zinc-100">Report an item</h1>
        <p className="mt-2 text-zinc-400">Public info powers matching. Private info powers ownership verification.</p>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <label className="block">
            <div className="text-sm font-semibold text-zinc-200 mb-2">Type</div>
            <select
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-100 shadow-sm focus:outline-none focus:ring-4 focus:ring-pink-500/15 focus:border-pink-400/40"
              {...register("type")}
            >
              <option value="LOST">Lost</option>
              <option value="FOUND">Found</option>
            </select>
          </label>

          <Input label="Title" placeholder="e.g., Black wallet, AirPods case" {...register("title")} />
          <Textarea label="Description" rows={4} placeholder="Any distinctive details (public)..." {...register("description")} />

          <div className="grid md:grid-cols-2 gap-4">
            <Input label="Category" placeholder="e.g., Electronics" {...register("category")} />
            <Input label="Color" placeholder="e.g., Black" {...register("color")} />
          </div>

          <Input label="Location" placeholder="e.g., Library 2nd floor" {...register("location")} />
          <Input label="Approx. Date/Time (ISO)" placeholder={new Date().toISOString()} {...register("eventAt")} />

          <div className="pt-2 border-t border-white/10">
            <h2 className="text-lg font-bold text-zinc-100 mt-4">Private verification (not public)</h2>
            <p className="mt-2 text-zinc-400">These answers will be asked only during a claim and shown only to admins.</p>
            <div className="mt-4 space-y-4">
              <Input label="Brand" {...register("privateBrand")} />
              <Input label="Unique mark / damage" {...register("privateUniqueMark")} />
              <Input label="Contents" {...register("privateContents")} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-4">
            <SecondaryButton type="button" onClick={() => reset()}>
              Clear
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit report"}
            </PrimaryButton>
          </div>
        </form>
      </Card>
    </div>
  );
}

