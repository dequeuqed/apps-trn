import { zodResolver } from '@hookform/resolvers/zod';
import { useId, type ReactNode } from 'react';
import { useForm, type FieldError } from 'react-hook-form';
import type { Campaign } from '../api/campaigns.ts';
import { ApiError } from '../api/http.ts';
import {
  campaignFormSchema,
  emptyCampaignForm,
  formFieldFor,
  type CampaignFormValues,
} from './campaign-form.schema.ts';
import { useCreateCampaign } from './queries.ts';

const CHANNEL_SUGGESTIONS = ['tv', 'radio', 'web', 'social', 'print', 'outdoor'];

interface CampaignFormProps {
  onCreated: (campaign: Campaign) => void;
  onCancel: () => void;
}

export function CampaignForm({ onCreated, onCancel }: CampaignFormProps) {
  const id = useId();
  const create = useCreateCampaign();
  const {
    register,
    handleSubmit,
    setError,
    trigger,
    getFieldState,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: emptyCampaignForm,
    // Show a field's error once it loses focus, then update as they type.
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async (input) => {
    try {
      onCreated(await create.mutateAsync(input));
    } catch (error) {
      const fieldErrors = error instanceof ApiError ? error.fieldErrors : [];
      let matched = false;
      for (const { field, message } of fieldErrors) {
        const name = field ? formFieldFor(field) : undefined;
        if (name) {
          setError(name, { type: 'server', message });
          matched = true;
        }
      }
      if (!matched) {
        setError('root.server', {
          type: 'server',
          message:
            error instanceof ApiError && error.status === 400
              ? 'The server rejected this campaign. Check the fields and try again.'
              : "Couldn't create the campaign. Try again.",
        });
      }
    }
  });

  const field = (
    name: keyof CampaignFormValues,
    label: string,
    input: (props: {
      id: string;
      'aria-invalid': boolean;
      'aria-describedby'?: string;
    }) => ReactNode,
    hint?: string,
  ) => {
    const inputId = `${id}-${name}`;
    const error: FieldError | undefined = errors[name];
    const described = [hint && `${inputId}-hint`, error && `${inputId}-error`]
      .filter(Boolean)
      .join(' ');
    return (
      <div className="field">
        <label htmlFor={inputId}>{label}</label>
        {input({
          id: inputId,
          'aria-invalid': Boolean(error),
          'aria-describedby': described || undefined,
        })}
        {hint && (
          <p className="field-hint" id={`${inputId}-hint`}>
            {hint}
          </p>
        )}
        {error && (
          <p className="field-error" id={`${inputId}-error`}>
            {error.message}
          </p>
        )}
      </div>
    );
  };

  return (
    <form
      className="campaign-form"
      aria-label="New campaign"
      onSubmit={onSubmit}
      noValidate
    >
      <div className="form-grid">
        {field('name', 'Name', (props) => (
          <input {...props} {...register('name')} autoComplete="off" />
        ))}
        {field('supplier', 'Supplier', (props) => (
          <input {...props} {...register('supplier')} autoComplete="off" />
        ))}
        {field(
          'regionCode',
          'Region',
          (props) => (
            <input {...props} {...register('regionCode')} autoComplete="off" />
          ),
          'Region code, e.g. UA-30',
        )}
        {field('channel', 'Channel', (props) => (
          <>
            <input
              {...props}
              {...register('channel')}
              list={`${id}-channels`}
              autoComplete="off"
            />
            <datalist id={`${id}-channels`}>
              {CHANNEL_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </>
        ))}
        {field('budget', 'Budget', (props) => (
          <input {...props} {...register('budget')} inputMode="decimal" />
        ))}
        {field('startDate', 'Start date', (props) => (
          <input
            {...props}
            type="date"
            {...register('startDate', {
              // Re-check the end date against the new start once it's been
              // touched, so a stale "before start" error doesn't linger.
              onChange: () => {
                if (getFieldState('endDate').isTouched) void trigger('endDate');
              },
            })}
          />
        ))}
        {field('endDate', 'End date', (props) => (
          <input {...props} type="date" {...register('endDate')} />
        ))}
      </div>

      {errors.root?.server && (
        <p className="form-error" role="alert">
          {errors.root.server.message}
        </p>
      )}

      <div className="form-actions">
        <button type="button" className="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="submit"
          className="button button-primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating…' : 'Create campaign'}
        </button>
      </div>
    </form>
  );
}
