import { useEffect } from 'react';
import WarehouseScene from '@/components/scene/WarehouseScene';
import TopToolbar from '@/components/layout/TopToolbar';
import LeftPanel from '@/components/panels/LeftPanel';
import RightPanel from '@/components/panels/RightPanel';
import BottomTimeline from '@/components/layout/BottomTimeline';
import ToastContainer from '@/components/common/ToastContainer';
import Legend from '@/components/common/Legend';
import { useStore } from '@/store/useStore';

export default function Dashboard() {
  const { loadSampleData, conflicts, addToast } = useStore();

  useEffect(() => {
    const hasEmptyDataset = conflicts.some((c) => c.type === 'empty_dataset');
    const hasDamagedLayout = conflicts.some((c) => c.type === 'damaged_layout');

    if (hasEmptyDataset) {
      addToast({ type: 'error', message: '数据集为空，将自动载入样例数据' });
      loadSampleData();
    }

    if (hasDamagedLayout) {
      addToast({ type: 'error', message: '布局配置损坏，请检查导入的JSON文件' });
    }
  }, [conflicts, addToast, loadSampleData]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950">
      <div className="absolute inset-0">
        <WarehouseScene />
      </div>

      <TopToolbar />
      <LeftPanel />
      <RightPanel />
      <BottomTimeline />
      <Legend />
      <ToastContainer />
    </div>
  );
}
