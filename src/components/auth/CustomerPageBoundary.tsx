import ServerRoleBoundary from './ServerRoleBoundary';

export default function CustomerPageBoundary({ children }: { children: React.ReactNode }) {
  return <ServerRoleBoundary role="customer">{children}</ServerRoleBoundary>;
}
