const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  // Campaign dates are calendar dates; format them without a timezone shift.
  timeZone: 'UTC',
});

export const formatDate = (isoDate: string) =>
  dateFormat.format(new Date(`${isoDate}T00:00:00Z`));

const amountFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatBudget = (cents: number) => amountFormat.format(cents / 100);
