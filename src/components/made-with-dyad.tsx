export const MadeWithDyad = () => {
  const year = new Date().getFullYear();
  return (
    <div className="p-4 text-center">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        &copy; {year} Kirknetworks, LLC (KirkNet). All rights reserved.
      </p>
    </div>
  );
};