export interface User {
  id: string;
  name: string;
  email: string;
  gender: "Male" | "Female";
  joiningDate: string;
  city?: string;
  department?: string;
  salary?: number;
  isActive?: boolean;
}

export const INITIAL_USERS: User[] = [
  { id: "848733049-5", name: "Venita Benford",   email: "vbenford0@epa.gov",             gender: "Female", joiningDate: "10/28/2022", city: "New York", department: "Engineering", salary: 75000, isActive: true },
  { id: "423400951-2", name: "Sylvan Messier",   email: "smessier1@domainmarket.com",    gender: "Male",   joiningDate: "8/28/2022",  city: "San Francisco", department: "Marketing", salary: 68000, isActive: true },
  { id: "209467622-6", name: "Padget Moffat",    email: "pmoffat2@pinterest.com",        gender: "Male",   joiningDate: "6/30/2022",  city: "Chicago", department: "Sales", salary: 82000, isActive: false },
  { id: "186217536-5", name: "Trever Muck",      email: "tmuck3@tinypic.com",            gender: "Male",   joiningDate: "11/9/2021", city: "Boston", department: "Engineering", salary: 79000, isActive: true },
  { id: "787129607-8", name: "Raymond Roughey",  email: "rroughey4@bloglines.com",       gender: "Male",   joiningDate: "2/26/2022", city: "Seattle", department: "Product", salary: 92000, isActive: true },
  { id: "783681643-5", name: "Dougy Londing",    email: "dlonding5@example.com",         gender: "Male",   joiningDate: "1/5/2022",   city: "Austin", department: "Support", salary: 55000, isActive: true },
  { id: "028073372-0", name: "See Marqyes",      email: "smarqyes6@archive.org",         gender: "Male",   joiningDate: "3/29/2022", city: "Denver", department: "Engineering", salary: 73000, isActive: false },
  { id: "573505647-6", name: "Minor Eisikowitz", email: "meisikowitze@wisc.edu",         gender: "Male",   joiningDate: "11/14/2021", city: "Portland", department: "Design", salary: 71000, isActive: true },
];
