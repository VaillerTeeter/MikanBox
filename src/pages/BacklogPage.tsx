import WatchListPage from './WatchListPage';

interface Props {
  isActive?: boolean;
}
export default function BacklogPage({ isActive }: Props) {
  return <WatchListPage status="补番计划" isActive={isActive} layout="grid" />;
}
