import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const createUserSchema = z.object({
  email: z.string().email('Invalid email address format.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  full_name: z.string().min(1, 'Full name is required.'),
  role: z.string().min(1, 'Role is required.'),
  designation: z.string().min(1, 'Designation is required.'),
});

export async function POST(request: Request) {
  try {
    // 1. Authenticate caller session using server client
    const supabase = await createClient();
    const {
      data: { user: callerUser },
    } = await supabase.auth.getUser();

    if (!callerUser) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in.' },
        { status: 401 }
      );
    }

    // 2. Verify caller is an Owner
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    const callerRole = callerProfile?.role?.trim().toLowerCase();
    if (callerRole !== 'owner') {
      return NextResponse.json(
        { error: 'Permission denied. Only Owner can create new users.' },
        { status: 403 }
      );
    }

    // 3. Parse and validate request payload
    const body = await request.json();
    const parseResult = createUserSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid form data.';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { email, password, full_name, role: inputRole, designation } = parseResult.data;
    const normalizedRole = inputRole.trim().toLowerCase();

    if (!['owner', 'admin', 'staff'].includes(normalizedRole)) {
      return NextResponse.json(
        { error: 'Invalid system role. Must be owner, admin, or staff.' },
        { status: 400 }
      );
    }

    // 4. Initialize server-only admin client
    let adminClient;
    try {
      adminClient = createAdminClient();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Missing Supabase service key.';
      return NextResponse.json(
        { error: `Server Configuration Error: ${msg}` },
        { status: 500 }
      );
    }

    // 5. Create Auth user via Supabase Admin API
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        designation,
        role: normalizedRole,
      },
    });

    if (authError || !authData.user) {
      const errorMsg = authError?.message || 'Failed to create Supabase Auth user.';
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const createdUser = authData.user;

    // 6. Upsert user profile in public.profiles
    const { data: profileData, error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: createdUser.id,
        email,
        full_name,
        role: normalizedRole,
        designation,
        is_active: true,
      })
      .select('*')
      .single();

    if (profileError) {
      // Rollback Auth user creation if profile creation fails
      await adminClient.auth.admin.deleteUser(createdUser.id);
      return NextResponse.json(
        { error: `Profile creation failed: ${profileError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: profileData,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred.';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
