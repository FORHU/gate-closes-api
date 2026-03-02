import { TFile } from "../models/file.model";
import FileRepo from "../repositories/file.repository";

export default class FileSvc {
  static async create(file: TFile) {
    return FileRepo.create(file);
  }
}

