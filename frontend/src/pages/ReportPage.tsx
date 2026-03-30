import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../lib/apiClient";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";

type ReportFormValues = {
  type: "LOST" | "FOUND";
  title: string;
  description: string;
  category: string;
  color: string;
  location: string;
  eventAt: string;
  privateBrand: string;
  privateUniqueMark: string;
  privateContents: string;
};

export default function ReportPage() {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<ReportFormValues>({
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

  async function onSubmit(values: ReportFormValues) {
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
    } catch (e) {
      toast.error(apiErrorMessage(e));
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
            <div className="text-sm font-semibold text-zinc-200 mb-2">Type *</div>
            <select
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-100 shadow-sm focus:outline-none focus:ring-4 focus:ring-pink-500/15 focus:border-pink-400/40"
              {...register("type", { required: "Type is required" })}
            >
              <option value="LOST">Lost</option>
              <option value="FOUND">Found</option>
            </select>
          </label>

          <Input
            label="Title *"
            placeholder="e.g., Black wallet, AirPods case"
            required
            error={errors.title?.message}
            {...register("title", {
              required: "Title is required",
              minLength: { value: 3, message: "Title must be at least 3 characters" },
              setValueAs: (v) => (typeof v === "string" ? v.trim() : v)
            })}
          />
          <Textarea
            label="Description *"
            rows={4}
            placeholder="Any distinctive details (public)..."
            required
            error={errors.description?.message}
            {...register("description", {
              required: "Description is required",
              minLength: { value: 1, message: "Description is required" },
              setValueAs: (v) => (typeof v === "string" ? v.trim() : v)
            })}
          />

          <div className="grid md:grid-cols-2 gap-4">
            <Input
              label="Category *"
              placeholder="e.g., Electronics"
              required
              error={errors.category?.message}
              {...register("category", {
                required: "Category is required",
                minLength: { value: 2, message: "Category must be at least 2 characters" },
                setValueAs: (v) => (typeof v === "string" ? v.trim() : v)
              })}
            />
            <Input label="Color" placeholder="e.g., Black" {...register("color")} />
          </div>

          <Input
            label="Location *"
            placeholder="e.g., Library 2nd floor"
            required
            error={errors.location?.message}
            {...register("location", {
              required: "Location is required",
              minLength: { value: 2, message: "Location must be at least 2 characters" },
              setValueAs: (v) => (typeof v === "string" ? v.trim() : v)
            })}
          />
          <Input
            label="Approx. Date/Time (ISO) *"
            placeholder={new Date().toISOString()}
            required
            error={errors.eventAt?.message}
            {...register("eventAt", {
              required: "Date/Time is required",
              validate: (v) => (!Number.isNaN(Date.parse(v)) ? true : "Enter a valid ISO date/time")
            })}
          />

          <div className="pt-2 border-t border-white/10">
            <h2 className="text-lg font-bold text-zinc-100 mt-4">Private verification (required, not public)</h2>
            <p className="mt-2 text-zinc-400">These answers will be asked only during a claim and shown only to admins.</p>
            <div className="mt-4 space-y-4">
              <Input
                label="Brand *"
                required
                error={errors.privateBrand?.message}
                {...register("privateBrand", {
                  required: "Brand is required",
                  minLength: { value: 1, message: "Brand is required" },
                  setValueAs: (v) => (typeof v === "string" ? v.trim() : v)
                })}
              />
              <Input
                label="Unique mark / damage *"
                required
                error={errors.privateUniqueMark?.message}
                {...register("privateUniqueMark", {
                  required: "Unique mark / damage is required",
                  minLength: { value: 1, message: "Unique mark / damage is required" },
                  setValueAs: (v) => (typeof v === "string" ? v.trim() : v)
                })}
              />
              <Input
                label="Contents *"
                required
                error={errors.privateContents?.message}
                {...register("privateContents", {
                  required: "Contents is required",
                  minLength: { value: 1, message: "Contents is required" },
                  setValueAs: (v) => (typeof v === "string" ? v.trim() : v)
                })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-4">
            <SecondaryButton type="button" onClick={() => reset()}>
              Clear
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit report"}
            </PrimaryButton>
          </div>
        </form>
      </Card>
    </div>
  );
}

