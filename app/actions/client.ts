'use server';

import { redirect } from 'next/navigation';
import { requireCustomer } from '@/lib/auth/permissions';
import { emailSchema, egyptianPhoneSchema, personNamePart } from '@/lib/auth/identity';

function value(formData: FormData, key: string): string {
  const field = formData.get(key);
  return typeof field === 'string' ? field : '';
}

export async function updateClientProfileAction(formData: FormData) {
  const names = {
    firstName: personNamePart.safeParse(value(formData, 'firstName')),
    middleName: personNamePart.safeParse(value(formData, 'middleName')),
    lastName: personNamePart.safeParse(value(formData, 'lastName')),
  };
  const phone = egyptianPhoneSchema.safeParse(value(formData, 'phone'));
  const address = value(formData, 'address').trim();
  if (!names.firstName.success || !names.middleName.success || !names.lastName.success || !phone.success || address.length > 500) {
    redirect('/account?error=profile');
  }
  const fullName = `${names.firstName.data} ${names.middleName.data} ${names.lastName.data}`;
  const { supabase } = await requireCustomer('/account');
  const { error } = await supabase.rpc('update_my_client_profile', {
    target_name: fullName,
    target_first_name: names.firstName.data,
    target_middle_name: names.middleName.data,
    target_last_name: names.lastName.data,
    target_phone: phone.data,
    target_address: address,
  });
  if (error) redirect('/account?error=profile');
  redirect('/account?updated=1');
}

export async function updateCustomerEmailAction(formData: FormData) {
  const email = emailSchema.safeParse(value(formData, 'email'));
  if (!email.success) redirect('/account?error=email');
  const { supabase, user } = await requireCustomer('/account');
  if (email.data.toLowerCase() === (user.email ?? '').toLowerCase()) redirect('/account');
  const { error } = await supabase.auth.updateUser({ email: email.data });
  if (error) redirect('/account?error=email');
  // Supabase requires confirmation before the new address becomes the Auth identity.
  redirect('/account?email=sent');
}
