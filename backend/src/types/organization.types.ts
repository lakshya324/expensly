import { Document, Types } from "mongoose";
import { Currency } from "../config/constants.js";

export interface IDepartment {
  _id: Types.ObjectId;
  name: string;
  budget: number;
  spent: number;
  currency: Currency;
}

export interface IOrganization extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  isDisabled: boolean;
  totalBudget: number;
  departments: Types.DocumentArray<IDepartment>;
  createdAt: Date;
  updatedAt: Date;

  //! Functions
  data(this: IOrganization): IOrganizationData;

  departmentData(this: IOrganization): IDepartmentData[];
}

export interface IOrganizationData {
  _id: string;
  name: string;
  slug: string;
  isDisabled: boolean;
  totalBudget: number;
}

export interface IDepartmentData {
  _id: string;
  name: string;
  budget: number;
  spent: number;
  currency: Currency;
}
