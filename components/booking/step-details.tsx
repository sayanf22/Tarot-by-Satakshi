import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm, useWatch, type DefaultValues } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { describedBy, Field, TextArea, TextInput } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { detailsSchema, todayIso, topics, type BookingDetails } from "@/lib/validation/booking";

const blank: DefaultValues<BookingDetails> = {
  name: "",
  email: "",
  phone: "",
  question: "",
  birthDate: "",
  birthTime: "",
  birthTimeUnknown: false,
  birthTimeApprox: "",
  birthPlace: "",
};

type Props = {
  needsBirthDetails: boolean;
  initial?: BookingDetails;
  onBack: () => void;
  onSubmit: (details: BookingDetails) => void;
};

export function StepDetails({ needsBirthDetails, initial, onBack, onSubmit }: Props) {
  const schema = useMemo(() => detailsSchema(needsBirthDetails), [needsBirthDetails]);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<BookingDetails>({
    resolver: zodResolver(schema),
    defaultValues: initial ?? blank,
    mode: "onTouched",
  });

  const timeUnknown = useWatch({ control, name: "birthTimeUnknown" });
  const today = todayIso();

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-12">
      <section aria-labelledby="about-you" className="space-y-6">
        <h2 id="about-you" className="font-display text-2xl text-ink">
          About you
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field id="name" label="Full name" error={errors.name?.message} className="sm:col-span-2">
            <TextInput
              id="name"
              autoComplete="name"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={describedBy("name", errors.name?.message)}
              {...register("name")}
            />
          </Field>
          <Field
            id="email"
            label="Email"
            error={errors.email?.message}
            hint="Your confirmation is sent here."
          >
            <TextInput
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={describedBy("email", errors.email?.message, true)}
              {...register("email")}
            />
          </Field>
          <Field
            id="phone"
            label="WhatsApp number"
            error={errors.phone?.message}
            hint="Include the country code if outside India."
          >
            <TextInput
              id="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={describedBy("phone", errors.phone?.message, true)}
              {...register("phone")}
            />
          </Field>
        </div>
      </section>

      <section aria-labelledby="your-question" className="space-y-6">
        <h2 id="your-question" className="font-display text-2xl text-ink">
          Your question
        </h2>
        <fieldset aria-describedby={errors.topic ? "topic-error" : undefined}>
          <legend className="mb-3 text-sm font-semibold text-ink">What is it about?</legend>
          <div className="flex flex-wrap gap-2.5">
            {topics.map((t) => (
              <label key={t.value} className="cursor-pointer">
                <input type="radio" value={t.value} className="peer sr-only" {...register("topic")} />
                <span
                  className={cn(
                    "inline-flex rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition-colors",
                    "peer-checked:border-gold-700 peer-checked:bg-champagne peer-checked:text-gold-800 hover:border-gold-500",
                    "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-700",
                  )}
                >
                  {t.label}
                </span>
              </label>
            ))}
          </div>
          {errors.topic ? (
            <p id="topic-error" role="alert" className="mt-2 text-sm font-medium text-danger">
              {errors.topic.message}
            </p>
          ) : null}
        </fieldset>
        <Field id="question" label="Your question" optional error={errors.question?.message}>
          <TextArea
            id="question"
            rows={4}
            maxLength={1000}
            aria-invalid={Boolean(errors.question)}
            aria-describedby={describedBy("question", errors.question?.message)}
            {...register("question")}
          />
        </Field>
      </section>

      {needsBirthDetails ? (
        <section aria-labelledby="birth-details" className="space-y-6">
          <div>
            <h2 id="birth-details" className="font-display text-2xl text-ink">
              Birth details
            </h2>
            <p className="mt-1 text-sm text-ink-muted">Needed to prepare your chart.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field id="birthDate" label="Date of birth" error={errors.birthDate?.message}>
              <TextInput
                id="birthDate"
                type="date"
                max={today}
                aria-invalid={Boolean(errors.birthDate)}
                aria-describedby={describedBy("birthDate", errors.birthDate?.message)}
                {...register("birthDate")}
              />
            </Field>
            {timeUnknown ? (
              <Field
                id="birthTimeApprox"
                label="Approximate time"
                optional
                error={errors.birthTimeApprox?.message}
                hint="For example: early morning, around 6 pm."
              >
                <TextInput
                  id="birthTimeApprox"
                  aria-describedby={describedBy("birthTimeApprox", errors.birthTimeApprox?.message, true)}
                  {...register("birthTimeApprox")}
                />
              </Field>
            ) : (
              <Field id="birthTime" label="Time of birth" error={errors.birthTime?.message}>
                <TextInput
                  id="birthTime"
                  type="time"
                  aria-invalid={Boolean(errors.birthTime)}
                  aria-describedby={describedBy("birthTime", errors.birthTime?.message)}
                  {...register("birthTime")}
                />
              </Field>
            )}
            <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-ink sm:col-span-2">
              <input type="checkbox" className="size-4 accent-gold-700" {...register("birthTimeUnknown")} />I
              don&apos;t know my exact time
            </label>
            <Field
              id="birthPlace"
              label="Place of birth"
              error={errors.birthPlace?.message}
              hint="City, state, country."
              className="sm:col-span-2"
            >
              <TextInput
                id="birthPlace"
                autoComplete="off"
                aria-invalid={Boolean(errors.birthPlace)}
                aria-describedby={describedBy("birthPlace", errors.birthPlace?.message, true)}
                {...register("birthPlace")}
              />
            </Field>
          </div>
        </section>
      ) : null}

      <div className="flex items-center justify-between border-t border-line pt-8">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit">Review booking</Button>
      </div>
    </form>
  );
}
