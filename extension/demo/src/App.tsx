import { DynamicTable } from "./components/DynamicTable";
import { INITIAL_USERS } from "./data";

export default function App() {
  return <DynamicTable data={INITIAL_USERS} />;
}
