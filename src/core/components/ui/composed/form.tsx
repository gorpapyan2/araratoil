
import React from "react";
import { cn } from "@/shared/utils/cn";
import {
  useForm,
  UseFormReturn,
  FieldValues,
  SubmitHandler,
  UseFormProps,
  FieldPath,
  FieldErrors,
  Controller,
  ControllerRenderProps,
} from "react-hook-form";
import { Label } from "@/core/components/ui/label";

/**
 * Base props for all Form Field components
 */
interface FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  name: TName;
  form: UseFormReturn<TFieldValues>;
}

// Create a properly typed context that can handle generic types
const FormFieldContext = React.createContext<FormFieldContextValue | null>(null);

/**
 * Form component that provides context for form fields
 */
const Form = <TFieldValues extends FieldValues = FieldValues, TContext = unknown>({
  children,
  className,
  onSubmit,
  formProps,
  form,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  onSubmit?: SubmitHandler<TFieldValues>;
  formProps?: UseFormProps<TFieldValues, TContext>;
  form?: UseFormReturn<TFieldValues>;
} & Omit<React.FormHTMLAttributes<HTMLFormElement>, "onSubmit">) => {
  // Always call useForm, but use provided form if available
  const defaultForm = useForm<TFieldValues>({ ...formProps });
  const formInstance = form || defaultForm;

  return (
    <form
      className={cn("space-y-6", className)}
      onSubmit={onSubmit ? formInstance.handleSubmit(onSubmit) : undefined}
      {...props}
    >
      {children}
    </form>
  );
};

/**
 * FormField component that provides context for form control components
 */
const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  name,
  form,
  children,
}: {
  name: TName;
  form: UseFormReturn<TFieldValues>;
  children: React.ReactNode;
}) => {
  const contextValue = { name, form } as FormFieldContextValue<TFieldValues, TName>;
  
  return (
    <FormFieldContext.Provider value={contextValue as FormFieldContextValue}>
      {children}
    </FormFieldContext.Provider>
  );
};

/**
 * Hook to get the current form field context
 */
const useFormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>() => {
  const context = React.useContext(FormFieldContext) as FormFieldContextValue<TFieldValues, TName> | null;
  if (!context) {
    throw new Error("useFormField must be used within a FormField");
  }
  return context;
};

/**
 * FormItem component for grouping a label, input, and error message
 */
interface FormItemProps {
  children: React.ReactNode;
  className?: string;
}

const FormItem = React.forwardRef<HTMLDivElement, FormItemProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("space-y-2", className)} {...props}>
        {children}
      </div>
    );
  }
);
FormItem.displayName = "FormItem";

/**
 * FormLabel component for labeling form controls
 */
interface FormLabelProps extends React.ComponentPropsWithoutRef<typeof Label> {
  optional?: boolean;
}

const FormLabel = React.forwardRef<
  React.ElementRef<typeof Label>,
  FormLabelProps
>(({ className, optional, children, ...props }, ref) => {
  return (
    <Label ref={ref} className={cn(className)} {...props}>
      {children}
      {optional && (
        <span className="ml-1 text-muted-foreground text-xs">(Optional)</span>
      )}
    </Label>
  );
});
FormLabel.displayName = "FormLabel";

/**
 * FormDescription component for providing additional context
 */
const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  );
});
FormDescription.displayName = "FormDescription";

/**
 * FormMessage component for displaying validation errors
 */
interface FormMessageProps extends React.HTMLAttributes<HTMLParagraphElement> {
  error?: FieldErrors;
}

const FormMessage = React.forwardRef<HTMLParagraphElement, FormMessageProps>(
  ({ className, children, error, ...props }, ref) => {
    const { name, form } = useFormField();
    const fieldError = error || form.formState.errors[name];
    const message = fieldError?.message as string | undefined;

    if (!message && !children) {
      return null;
    }

    return (
      <p
        ref={ref}
        className={cn("text-xs font-medium text-destructive", className)}
        {...props}
      >
        {children || message}
      </p>
    );
  }
);
FormMessage.displayName = "FormMessage";

/**
 * FormControl component for managing form control state
 */
interface FormControlProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  children?: (props: {
    field: ControllerRenderProps<TFieldValues, TName>;
  }) => React.ReactElement;
  render?: (props: {
    field: ControllerRenderProps<TFieldValues, TName>;
  }) => React.ReactElement;
}

const FormControl = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  children,
  render,
}: FormControlProps<TFieldValues, TName>) => {
  const { name, form } = useFormField<TFieldValues, TName>();

  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => {
        const renderFn = render || children;
        if (!renderFn) {
          throw new Error("FormControl requires either children or render prop");
        }
        return renderFn({ field });
      }}
    />
  );
};

/**
 * Form component with all its subcomponents
 */
const FormRoot = Object.assign(Form, {
  Field: FormField,
  Item: FormItem,
  Label: FormLabel,
  Control: FormControl,
  Description: FormDescription,
  Message: FormMessage,
  useFormField,
});

export { FormRoot as Form };
