import Link from 'next/link';

export default function Home() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Owner Console</h1>
      <p className="mt-2">
        Go to <Link className="underline" href="/services">Services Moderation</Link>,{' '}
        <Link className="underline" href="/ads">Ads Manager</Link> or{' '}
        <Link className="underline" href="/login">Login</Link>.
      </p>
    </div>
  );
}
