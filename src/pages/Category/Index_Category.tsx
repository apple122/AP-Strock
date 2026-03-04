import Button from "../../components/ui/button/Button";
import { useCategories } from './useCategories';
import CategoryTable from './CategoryTable';

export default function Index_Category() {
  const {
    categories,
    totalCount,
    loading,
    error,
    fetchCategories,
    handleCreate,
    handleUpdate,
    handleDelete,
  } = useCategories()

  return (
    <>
      <div className="flex justify-end mb-2 gap-1">
        <Button size="sm" className='h-6' variant="outline" onClick={handleCreate}>
          ເພີມລາຍການ
        </Button>
        <Button size="sm" className='h-6' variant="outline" onClick={fetchCategories}>
          Refresh
        </Button>
      </div>

      {error && (
        <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-red-900 dark:text-red-200">
          {error}
        </div>
      )}

      <CategoryTable
        categories={categories}
        totalCount={totalCount}
        loading={loading}
        handleUpdate={handleUpdate}
        handleDelete={handleDelete}
      />
    </>
  )
}

