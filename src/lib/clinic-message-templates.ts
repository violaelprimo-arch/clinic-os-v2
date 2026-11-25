export const messageDefaults = {
  booking_confirmation:
    'أهلًا {اسم_المريض}، تم تأكيد حجزك في {اسم_العيادة} يوم {الموعد}.',
  appointment_reminder:
    'أهلًا {اسم_المريض}، بنفكّرك بموعدك في {اسم_العيادة} يوم {الموعد}.',
  appointment_rescheduled: 'أهلًا {اسم_المريض}، تم تعديل موعدك إلى {الموعد}.',
  appointment_cancelled: 'أهلًا {اسم_المريض}، تم إلغاء حجزك يوم {الموعد}.',
  prescription: 'أهلًا {اسم_المريض}، دي روشتتك من {اسم_العيادة}.',
  invoice: 'أهلًا {اسم_المريض}، دي فاتورتك من {اسم_العيادة}.',
}
export type MessageKind = keyof typeof messageDefaults
export function renderClinicMessage(
  template: string,
  patient: string,
  clinic: string,
  when: string,
) {
  const values: Record<string, string> = {
    اسم_المريض: patient,
    اسم_العيادة: clinic,
    الموعد: when,
  }
  return template.replace(
    /\{(اسم_المريض|اسم_العيادة|الموعد)\}/g,
    (_, key: string) => values[key],
  )
}
