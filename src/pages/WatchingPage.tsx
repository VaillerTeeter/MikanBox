import WatchListPage from './WatchListPage';

interface Props {
  isActive?: boolean;
}
export default function WatchingPage({ isActive }: Props) {
  return <WatchListPage status="正在追番" isActive={isActive} layout="weekday" />;
}
