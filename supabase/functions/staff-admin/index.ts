// Staff management for managers: add people, change names and roles, reset passwords,
// and deactivate or reactivate accounts. Runs on Supabase so the secret key never
// reaches the app. The platform checks the caller's sign-in token (verify_jwt), and
// this function then checks the caller is an active manager.
import { withSupabase } from 'npm:@supabase/server@1';

type Role = 'manager' | 'dispatcher';

type Request =
  | { action: 'create'; email: string; password: string; fullName: string; role: Role }
  | { action: 'update'; id: string; fullName?: string; role?: Role; password?: string; active?: boolean };

const fail = (message: string, status = 400) => Response.json({ error: message }, { status });

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    const admin = ctx.supabaseAdmin;
    const callerId = ctx.userClaims?.id;
    if (!callerId) return fail('Not signed in.', 401);

    const { data: caller } = await admin.from('profiles').select('role, active').eq('id', callerId).maybeSingle();
    if (!caller?.active || caller.role !== 'manager') return fail('Only managers can manage staff.', 403);

    let body: Request;
    try {
      body = await req.json();
    } catch {
      return fail('Invalid request.');
    }

    if (body.action === 'create') {
      const email = body.email?.trim().toLowerCase();
      const fullName = body.fullName?.trim();
      if (!email?.includes('@')) return fail('Enter a valid email.');
      if (!body.password || body.password.length < 8) return fail('Password must be at least 8 characters.');
      if (!fullName) return fail('Enter a name.');

      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: body.password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (error) {
        return fail(error.message.includes('already') ? 'Someone already has an account with that email.' : error.message);
      }
      // The sign-up trigger created the profile as a dispatcher; set the chosen role.
      if (body.role === 'manager') {
        await admin.from('profiles').update({ role: 'manager' }).eq('id', data.user.id);
      }
      return Response.json({ id: data.user.id });
    }

    if (body.action === 'update') {
      if (!body.id) return fail('Missing staff id.');
      // A manager can't lock themselves out, so there is always someone left to fix things.
      if (body.id === callerId && (body.role === 'dispatcher' || body.active === false)) {
        return fail("You can't remove your own manager access. Ask another manager.");
      }

      const profile: Record<string, unknown> = {};
      if (body.fullName !== undefined) {
        if (!body.fullName.trim()) return fail('Enter a name.');
        profile.full_name = body.fullName.trim();
      }
      if (body.role !== undefined) {
        if (body.role !== 'manager' && body.role !== 'dispatcher') return fail('Unknown role.');
        profile.role = body.role;
      }
      if (body.active !== undefined) profile.active = body.active;

      if (body.password !== undefined) {
        if (body.password.length < 8) return fail('Password must be at least 8 characters.');
        const { error } = await admin.auth.admin.updateUserById(body.id, { password: body.password });
        if (error) return fail(error.message);
      }
      if (body.active !== undefined) {
        // Banning also ends their sessions, so a deactivated person is signed out.
        const { error } = await admin.auth.admin.updateUserById(body.id, {
          ban_duration: body.active ? 'none' : '876000h',
        });
        if (error) return fail(error.message);
      }
      if (Object.keys(profile).length > 0) {
        const { error } = await admin.from('profiles').update(profile).eq('id', body.id);
        if (error) return fail(error.message);
      }
      return Response.json({ ok: true });
    }

    return fail('Unknown action.');
  }),
};
