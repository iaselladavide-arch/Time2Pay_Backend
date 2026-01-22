export interface GroupMember {
  _id: string;
  username: string;
  name: string;
  surname?: string;
  profileImage?: string;
}

export interface Expense {
  _id: string;
  description: string;
  amount: number;
  paidBy: GroupMember;
  createdAt: string;
  summary: {
    totalAmount: number;
    paidAmount: number;
    unpaidAmount: number;
  };
  amountPerPerson?: number;
  splitBetween?: GroupMember[];
  paidDebts?: Array<{ from: string; to: string }>;

  done?: boolean;
  creator?: GroupMember;
  gruppo?: string;
  tagName?: string;
  tagColor?: string;
}
